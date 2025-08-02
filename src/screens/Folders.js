import { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMedia } from '../contexts/MediaContext';
import FolderItem from '../components/FolderItem';
import * as MediaLibrary from 'expo-media-library';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useAppState } from '../contexts/AppStateContext';

export default function Folders() {
    const { needsRefresh, completeRefresh } = useAppState();

    const navigation = useNavigation();

    const [permissions, requestPermissions] = MediaLibrary.usePermissions();
    const {
        getAllFolders,
        refreshAllData,
        loading,
        errors,
        lastRefreshed,
        getFolderCompletionStats
    } = useMedia();

    // Get sorted folders array
    const folders = getAllFolders();

    // Get completion statistics
    const completionStats = folders.reduce((stats, folder) => {
        const folderStats = getFolderCompletionStats(folder.id);
        if (folderStats?.isCompleted) {
            stats.completed++;
            stats.totalItemsToDelete += folderStats.itemsToDelete;
        } else if (folderStats?.status === 'in-progress') {
            stats.inProgress++;
        }
        return stats;
    }, { completed: 0, inProgress: 0, totalItemsToDelete: 0 });

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
                        reset: false
                    });
                }}
            />
        );
    };

    if (!permissions) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!permissions.granted) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <Ionicons name="folder-open-outline" size={48} color="#888" />
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

    if (loading.refresh) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.loadingText}>
                        {folders.length > 0 ? 'Refreshing...' : 'Loading folders...'}
                    </Text>
                </View>
            </View>
        );
    }

    if (errors.refresh) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <Ionicons name="warning" size={48} color="#ff5555" />
                    <Text style={styles.errorText}>Error loading folders</Text>
                    <Text style={styles.errorSubtext}>{errors.refresh}</Text>
                    <TouchableOpacity
                        onPress={refreshAllData}
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
                        {folders.length} folder{folders.length !== 1 ? 's' : ''}
                        {completionStats.completed > 0 && ` • ${completionStats.completed} completed`}
                        {completionStats.inProgress > 0 && ` • ${completionStats.inProgress} in progress`}
                        {lastRefreshed && ` • Updated ${new Date(lastRefreshed).toLocaleTimeString()}`}
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={refreshAllData}
                    style={styles.refreshButton}
                    disabled={loading.refresh}
                >
                    <Ionicons
                        name="refresh"
                        size={20}
                        color={loading.refresh ? '#444' : '#666'}
                    />
                </TouchableOpacity>
            </View>

            {/* Summary stats */}
            {(completionStats.completed > 0 || completionStats.inProgress > 0) && (
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryRow}>
                        {completionStats.completed > 0 && (
                            <View style={styles.summaryItem}>
                                <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                                <Text style={styles.summaryText}>
                                    {completionStats.completed} completed
                                </Text>
                            </View>
                        )}
                        {completionStats.inProgress > 0 && (
                            <View style={styles.summaryItem}>
                                <Ionicons name="time-outline" size={16} color="#FF9500" />
                                <Text style={styles.summaryText}>
                                    {completionStats.inProgress} in progress
                                </Text>
                            </View>
                        )}
                    </View>
                    {completionStats.totalItemsToDelete > 0 && (
                        <Text style={styles.summarySubtext}>
                            {completionStats.totalItemsToDelete} item{completionStats.totalItemsToDelete !== 1 ? 's' : ''} ready for deletion
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
                        <View style={styles.emptyContainer}>
                            <Ionicons name="folder-outline" size={48} color="#666" />
                            <Text style={styles.emptyText}>No media folders found</Text>
                            <TouchableOpacity
                                onPress={refreshAllData}
                                style={[styles.button, { marginTop: 16 }]}
                            >
                                <Text style={styles.buttonText}>Refresh</Text>
                            </TouchableOpacity>
                        </View>
                    }
                    refreshing={!!loading.refresh}
                    onRefresh={refreshAllData}
                    // Optional performance optimizations for FlatList
                    initialNumToRender={15}
                    maxToRenderPerBatch={15}
                    windowSize={10}
                    removeClippedSubviews={true}
                />
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
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
        backgroundColor: '#181818',
        borderBottomWidth: 0.75,
        borderBottomColor: '#55555555'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
    },
    headerSubtitle: {
        color: '#666',
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
        color: '#888',
        fontSize: 12,
        fontWeight: '500',
        height: 18
    },
    summarySubtext: {
        color: '#666',
        fontSize: 11,
        fontStyle: 'italic',
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
        color: '#666',
        fontSize: 16,
        marginTop: 12
    },
    loadingText: {
        color: '#888',
        marginTop: 12,
        fontSize: 14,
    },
    errorText: {
        color: '#ff5555',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 8
    },
    errorSubtext: {
        color: '#888',
        fontSize: 12,
        textAlign: 'center',
        marginBottom: 16,
        maxWidth: '80%'
    },
    button: {
        backgroundColor: '#333',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 6,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '500',
        fontSize: 14
    },
});