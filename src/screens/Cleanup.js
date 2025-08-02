import { View, Text, StyleSheet, Alert } from 'react-native';
import { useMedia } from '../contexts/MediaContext';
import CleanupPanel from '../components/CleanupPanel';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { useHistory } from '../contexts/HistoryContext';
import { useAppState } from '../contexts/AppStateContext';

export default function Cleanup({ route, navigation }) {
    const { folderId } = route.params;
    const { getFolderById, clearCompletedFolder } = useMedia();
    const { logDeletion } = useHistory();
    const { triggerRefresh } = useAppState();

    const folder = getFolderById(folderId);

    const handleComplete = async (assetsToDelete) => {
        try {
            //console.log('handleComplete called with', assetsToDelete.length, 'assets to delete');

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

                    logDeletion({
                        itemCount: assetsToDelete.length,
                        folderName: folder.name,
                        spaceFreed: totalFreed
                    });

                    triggerRefresh();

                    // Clear completed folder progress after successful deletion
                    await clearCompletedFolder(folderId);
                    navigation.goBack();

                } catch (error) {
                    console.error('Deletion failed:', error);
                    Alert.alert('Error', 'Failed to delete items. The cleanup progress has been saved.');
                    // Don't clear progress if deletion failed
                    navigation.goBack();
                }
            } else {
                // No items to delete but folder is completed
                //console.log('Folder completed with no items to delete');

                // Still mark as completed and clear progress
                await clearCompletedFolder(folderId);
                navigation.goBack();
            }
        } catch (error) {
            console.error('Cleanup error:', error);
            Alert.alert('Error', 'An error occurred during cleanup.');
            navigation.goBack();
        }
    };

    const handleClose = () => {
        // Progress is automatically saved, no need to do anything special
        navigation.goBack();
    };

    if (!folder) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Initializing...</Text>
            </View>
        );
    }

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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#181818',
        position: 'relative',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
    },
    loadingText: {
        color: '#8E8E93',
        fontSize: 14,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 22,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#55555555',
        position: 'relative',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        maxWidth: '100%',
        height: 30
    },
});