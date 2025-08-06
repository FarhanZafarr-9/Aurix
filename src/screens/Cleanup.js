import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useMedia } from '../contexts/MediaContext';
import { useTheme } from '../contexts/ThemeContext';
import CleanupPanel from '../components/CleanupPanel';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useHistory } from '../contexts/HistoryContext';
import { useAppState } from '../contexts/AppStateContext';

export default function Cleanup({ route, navigation }) {
    const { colors, saveDeletedHistory } = useTheme();
    const { folderId } = route.params;
    const {
        getFolderById,
        getFolderCompletionInfo,
        clearFolderCompletion
    } = useMedia();
    const { logDeletion } = useHistory();
    const { triggerRefresh } = useAppState();

    const folder = getFolderById(folderId);
    const completionInfo = getFolderCompletionInfo(folderId);

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.header,
            position: 'relative',
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
        },
        loadingText: {
            color: colors.textSecondary,
            fontSize: 14,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: 40,
            paddingHorizontal: 22,
            paddingBottom: 8,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
            position: 'relative',
        },
        title: {
            color: colors.text,
            fontSize: 18,
            fontWeight: '600',
            maxWidth: '100%',
            height: 30
        },
        completedContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
            padding: 24,
        },
        completedIcon: {
            marginBottom: 24,
        },
        completedTitle: {
            color: colors.text,
            fontSize: 24,
            fontWeight: '600',
            marginBottom: 12,
            textAlign: 'center',
        },
        completedSubtitle: {
            color: colors.textSecondary,
            fontSize: 16,
            marginBottom: 8,
            textAlign: 'center',
            lineHeight: 22,
        },
        completedStats: {
            color: colors.textTertiary,
            fontSize: 14,
            marginBottom: 32,
            textAlign: 'center',
        },
        actionButtons: {
            flexDirection: 'row',
            gap: 12,
            width: '100%',
        },
        actionButton: {
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
        },
        primaryButton: {
            backgroundColor: colors.primary + '48',
            borderColor: colors.primary,
        },
        secondaryButton: {
            backgroundColor: colors.card,
            borderColor: colors.border,
        },
        primaryButtonText: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
            height: 22
        },
        secondaryButtonText: {
            color: colors.textSecondary,
            fontSize: 16,
            fontWeight: '500',
            height: 22
        },
    }), [colors]);

    const handleComplete = async (assetsToDelete) => {
        try {
            console.log('handleComplete called with', assetsToDelete.length, 'assets to delete');

            if (assetsToDelete.length > 0) {
                try {
                    const assetIds = assetsToDelete.map(asset => asset.id);

                    // Calculate size
                    const sizes = await Promise.all(
                        assetsToDelete.map(async asset => {
                            try {
                                const info = await FileSystem.getInfoAsync(asset.uri);
                                return info.size || 0;
                            } catch {
                                return 0;
                            }
                        })
                    );
                    const totalFreed = sizes.reduce((sum, size) => sum + size, 0);

                    console.log('Deleting', assetIds.length, 'assets, freeing', totalFreed, 'bytes');
                    await MediaLibrary.deleteAssetsAsync(assetIds);

                    if (saveDeletedHistory) {
                        logDeletion({
                            itemCount: assetsToDelete.length,
                            folderName: folder.name,
                            spaceFreed: totalFreed
                        });
                    }

                    triggerRefresh();
                    navigation.goBack();

                } catch (error) {
                    console.error('Deletion failed:', error);
                    Alert.alert('Error', 'Failed to delete items. The cleanup progress has been saved.');
                    navigation.goBack();
                }
            } else {
                console.log('Folder completed with no items to delete');
                navigation.goBack();
            }
        } catch (error) {
            console.error('Cleanup error:', error);
            Alert.alert('Error', 'An error occurred during cleanup.');
            navigation.goBack();
        }
    };

    const handleClose = () => {
        navigation.goBack();
    };

    const handleReviewAgain = () => {
        navigation.goBack();
    };

    const handleRestartCleanup = async () => {
        try {
            console.log('Restarting cleanup for folder:', folderId);
            await clearFolderCompletion(folderId);
            navigation.goBack();
        } catch (error) {
            console.error('Failed to restart cleanup:', error);
            Alert.alert('Error', 'Failed to restart cleanup.');
        }
    };

    if (!folder) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Initializing...</Text>
            </View>
        );
    }

    if (completionInfo?.isCompleted) {
        console.log('Showing completion status for folder:', folder.name);
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={{ marginBottom: 8, marginRight: 8 }}>
                        <Ionicons name="close" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                        {folder.name}
                    </Text>
                </View>

                <View style={styles.completedContainer}>
                    <View style={styles.completedIcon}>
                        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                    </View>

                    <Text style={styles.completedTitle}>Cleanup Completed!</Text>

                    <Text style={styles.completedSubtitle}>
                        You've finished reviewing all {completionInfo.totalItems} items in this folder.
                    </Text>

                    <Text style={styles.completedStats}>
                        {completionInfo.itemsDeleted > 0
                            ? `${completionInfo.itemsDeleted} items deleted • ${completionInfo.itemsKept} items kept`
                            : `All ${completionInfo.itemsKept} items kept`
                        }
                    </Text>

                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.secondaryButton]}
                            onPress={handleReviewAgain}
                        >
                            <Text style={styles.secondaryButtonText}>Review Again</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.primaryButton]}
                            onPress={handleRestartCleanup}
                        >
                            <Text style={styles.primaryButtonText}>Restart Cleanup</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    console.log('Showing CleanupPanel for folder:', folder.name);
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                    {folder.name}
                </Text>
            </View>

            <CleanupPanel
                folderId={folderId}
                onComplete={handleComplete}
                onClose={handleClose}
                route={route}
            />
        </View>
    );
}