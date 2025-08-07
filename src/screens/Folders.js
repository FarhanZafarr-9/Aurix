import { useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMedia } from '../contexts/MediaContext';
import { useTheme } from '../contexts/ThemeContext';
import FolderItem from '../components/FolderItem';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppState } from '../contexts/AppStateContext';

const ProgressBar = ({ progress, height = 4, color = '#007AFF' }) => {
    const animatedWidth = useMemo(() => new Animated.Value(progress), []);

    useEffect(() => {
        Animated.timing(animatedWidth, {
            toValue: progress,
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [progress]);

    const width = animatedWidth.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={{ height, backgroundColor: 'rgba(0, 122, 255, 0.2)', borderRadius: height / 2 }}>
            <Animated.View style={{ height, width, backgroundColor: color, borderRadius: height / 2 }} />
        </View>
    );
};

export default function Folders() {
    const { colors, hideCompleted, showMediaCounts, showProgress } = useTheme();
    console.log("Colors:", colors);

    const { needsRefresh, completeRefresh } = useAppState();

    const navigation = useNavigation();

    const [permissions, requestPermissions] = MediaLibrary.usePermissions();
    const {
        getAllFolders,
        refreshAllData,
        loading,
        errors,
        lastRefreshed,
        isFolderCompleted,
        getFolderCompletionInfo,
        hasActiveSession,
        getCurrentSessionInfo
    } = useMedia();

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
            paddingBottom: 55
        },
        centerContent: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24
        },
        header: {
            paddingHorizontal: 20,
            paddingTop: 36,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.header,
            borderBottomWidth: 0.75,
            borderBottomColor: colors.borderLight
        },
        headerTitle: {
            color: colors.text,
            fontSize: 20,
            fontWeight: '600',
        },
        headerSubtitle: {
            color: colors.textSecondary,
            fontSize: 12,
            marginTop: 4,
            height: 18
        },
        refreshButton: {
            padding: 6,
            marginLeft: 10
        },
        summaryContainer: {
            paddingHorizontal: 20,
            paddingBottom: 10,
        },
        summaryRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginBottom: 4,
        },
        summaryItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingTop: 15
        },
        summaryText: {
            color: colors.textSecondary,
            fontSize: 12,
            fontWeight: '500',
            height: 18
        },
        summarySubtext: {
            color: colors.textTertiary,
            fontSize: 11,
            fontStyle: 'italic',
        },
        activeSessionBanner: {
            backgroundColor: '#FF9500',
            paddingHorizontal: 20,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            minHeight: 64
        },
        bannerText: {
            color: 'white',
            fontSize: 14,
            fontWeight: '600',
            height: 30,
            flex: 1,
        },
        bannerSubtext: {
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: 12,
            height: 16
        },
        resumeButton: {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
        },
        resumeButtonText: {
            color: 'white',
            fontSize: 12,
            fontWeight: '600',
        },
        listContent: {
            paddingHorizontal: 12,
            paddingBottom: 16,
            paddingTop: 8,
            minHeight: '100%'
        },
        emptyContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 40
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: 16,
            marginTop: 12
        },
        loadingContainer: {
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        loadingText: {
            color: colors.textSecondary,
            fontSize: 12,
            marginBottom: 8,
        },
        errorText: {
            color: '#ff5555',
            fontSize: 16,
            textAlign: 'center',
            marginBottom: 8
        },
        errorSubtext: {
            color: colors.textSecondary,
            fontSize: 12,
            textAlign: 'center',
            marginBottom: 16,
            maxWidth: '80%'
        },
        button: {
            backgroundColor: colors.card,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 6,
        },
        buttonText: {
            color: colors.text,
            fontWeight: '500',
            fontSize: 14
        },
    }), [colors]);

    // Get sorted folders array
    const folders = useMemo(() => {
        const all = getAllFolders();
        return hideCompleted ? all.filter(f => !isFolderCompleted(f.id)) : all;
    }, [getAllFolders, hideCompleted, isFolderCompleted]);

    const currentSession = getCurrentSessionInfo();

    // Calculate summary statistics
    const summaryStats = useMemo(() => {
        let completed = 0;
        let totalItemsDeleted = 0;
        let hasInProgress = currentSession.folderId !== null;

        folders.forEach(folder => {
            if (isFolderCompleted(folder.id)) {
                completed++;
                const info = getFolderCompletionInfo(folder.id);
                if (info) {
                    totalItemsDeleted += info.itemsDeleted;
                }
            }
        });

        return {
            completed,
            totalItemsDeleted,
            hasInProgress,
            activeSessionFolder: currentSession.folderId ?
                folders.find(f => f.id === currentSession.folderId) : null
        };
    }, [folders, isFolderCompleted, getFolderCompletionInfo, currentSession]);

    useFocusEffect(
        useCallback(() => {
            if (permissions?.granted) {
                if (needsRefresh) {
                    refreshAllData();
                    completeRefresh();
                }
            }
        }, [permissions, needsRefresh])
    );

    const renderFolderItem = ({ item }) => {
        return (
            <FolderItem
                folder={item}
                onPress={() => {
                    navigation.navigate('Cleanup', {
                        folderId: item.id,
                    });
                }}
                showCounts={showMediaCounts}
                showProgress={showProgress}
            />
        );
    };

    const handleResumeSession = () => {
        if (currentSession.folderId) {
            navigation.navigate('Cleanup', {
                folderId: currentSession.folderId,
            });
        }
    };

    if (!permissions) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={colors.textSecondary} />
            </View>
        );
    }

    if (!permissions.granted) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <Ionicons name="folder-open-outline" size={48} color={colors.textSecondary} />
                    <Text style={styles.errorText}>Media access required</Text>
                    <TouchableOpacity
                        onPress={requestPermissions}
                        style={styles.button}
                    >
                        <Text style={styles.buttonText}>Grant Access</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (errors.all) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <Ionicons name="warning" size={48} color="#ff5555" />
                    <Text style={styles.errorText}>Error loading folders</Text>
                    <Text style={styles.errorSubtext}>{errors.all}</Text>
                    <TouchableOpacity
                        onPress={() => refreshAllData(true)}
                        style={styles.button}
                    >
                        <Text style={styles.buttonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Media Folders</Text>
                    <Text style={styles.headerSubtitle}>
                        {loading.all && loading.total > 0
                            ? `Loaded ${loading.loaded}/${loading.total} folders`
                            : `${folders.length} folder${folders.length !== 1 ? 's' : ''}`}
                        {summaryStats.completed > 0 && ` • ${summaryStats.completed} completed`}
                        {summaryStats.hasInProgress && ' • 1 in progress'}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={() => refreshAllData(true)}
                    style={styles.refreshButton}
                    disabled={loading.all}
                >
                    <Ionicons
                        name="refresh"
                        size={20}
                        color={loading.all ? colors.textTertiary : colors.textSecondary}
                    />
                </TouchableOpacity>
            </View>

            {loading.all && (
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>
                        {loading.status || 'Calculating...'}
                    </Text>
                    <ProgressBar progress={loading.progress || 0} />
                </View>
            )}

            {/* Active session banner */}
            {summaryStats.hasInProgress && summaryStats.activeSessionFolder && showProgress && (
                <View style={styles.activeSessionBanner}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.bannerText}>
                            Cleanup in Progress
                        </Text>
                        <Text style={styles.bannerSubtext}>
                            {summaryStats.activeSessionFolder.name} • {currentSession.currentIndex}/{summaryStats.activeSessionFolder.totalCount} reviewed
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.resumeButton}
                        onPress={handleResumeSession}
                    >
                        <Text style={styles.resumeButtonText}>Resume</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Summary stats */}
            {(summaryStats.completed > 0) && (
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryRow}>
                        {summaryStats.completed > 0 && (
                            <View style={styles.summaryItem}>
                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                <Text style={styles.summaryText}>
                                    {summaryStats.completed} completed
                                </Text>
                            </View>
                        )}
                    </View>
                    {summaryStats.totalItemsDeleted > 0 && (
                        <Text style={styles.summarySubtext}>
                            {summaryStats.totalItemsDeleted} item{summaryStats.totalItemsDeleted !== 1 ? 's' : ''} deleted across all folders
                        </Text>
                    )}
                </View>
            )}

            <View style={{ flex: 1 }}>
                <FlatList
                    data={folders}
                    keyExtractor={item => item.id}
                    renderItem={renderFolderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        !loading.all && (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="folder-outline" size={48} color={colors.textSecondary} />
                                <Text style={styles.emptyText}>No media folders found</Text>
                                <TouchableOpacity
                                    onPress={refreshAllData}
                                    style={[styles.button, { marginTop: 16 }]}
                                >
                                    <Text style={styles.buttonText}>Refresh</Text>
                                </TouchableOpacity>
                            </View>
                        )
                    }
                    refreshing={!!loading.all}
                    onRefresh={() => refreshAllData(true)}
                    initialNumToRender={15}
                    maxToRenderPerBatch={15}
                    windowSize={10}
                    removeClippedSubviews={true}
                />
            </View>
        </View>
    );
}