import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import FolderView from '../components/FolderView';
import { useMedia } from '../contexts/MediaContext';

export default function FoldersScreen() {
    const [permissions, requestPermissions] = MediaLibrary.usePermissions();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [folders, setFolders] = useState([]);
    const [showGallery, setShowGallery] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState(null);

    const { loadFolderMedia, getFolderStats, cleanupProgress } = useMedia();

    useEffect(() => {
        if (permissions?.granted) {
            loadFolders();
        } else if (permissions?.canAskAgain) {
            requestPermissions();
        }
    }, [permissions]);

    const loadFolders = async () => {
        try {
            setIsLoading(true);
            setError(null);

            console.log('Loading albums...');
            const albums = await MediaLibrary.getAlbumsAsync({
                includeSmartAlbums: true,
            });

            console.log(`Found ${albums.length} albums`);
            const folderList = await processAlbums(albums);

            // Add "All Media" folder if it contains media
            const allMediaFolder = await getAllMediaFolder();
            if (allMediaFolder) {
                folderList.unshift(allMediaFolder);
            }

            console.log('Valid folders found:', folderList.length);
            setFolders(folderList);
        } catch (err) {
            console.log('Error:', err);
            setError('Failed to load media folders.');
        } finally {
            setIsLoading(false);
        }
    };

    const processAlbums = async (albums) => {
        const validFolders = [];

        for (const album of albums) {
            try {
                const folder = await processAlbum(album);
                if (folder) {
                    validFolders.push(folder);
                }
            } catch (err) {
                console.warn(`Error processing album ${album.title}:`, err);
            }
        }

        // Sort by item count (descending)
        return validFolders.sort((a, b) => b.itemCount - a.itemCount);
    };

    const processAlbum = async (album) => {
        const assetsPage = await MediaLibrary.getAssetsAsync({
            first: 1,
            album: album,
            mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        });

        if (assetsPage.totalCount === 0) return null;

        const sampleSize = Math.min(50, assetsPage.totalCount);
        const sampleAssets = await MediaLibrary.getAssetsAsync({
            first: sampleSize,
            album: album,
            mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        });

        const { photoCount, videoCount } = countMediaTypes(sampleAssets.assets);
        const ratio = assetsPage.totalCount / sampleSize;

        const folder = {
            id: album.id,
            name: album.title,
            album: album,
            itemCount: assetsPage.totalCount,
            photoCount: Math.round(photoCount * ratio),
            videoCount: Math.round(videoCount * ratio),
            totalCount: assetsPage.totalCount,
        };

        // Preload media for folders with reasonable size
        if (assetsPage.totalCount < 1000) {
            loadFolderMedia(album.id).catch(console.warn);
        }

        return folder;
    };

    const getAllMediaFolder = async () => {
        const totalAssets = await MediaLibrary.getAssetsAsync({
            first: 1,
            mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
        });

        if (totalAssets.totalCount === 0) return null;

        const sampleSize = Math.min(50, totalAssets.totalCount);
        const sampleAssets = await MediaLibrary.getAssetsAsync({
            first: sampleSize,
            mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video]
        });

        const { photoCount, videoCount } = countMediaTypes(sampleAssets.assets);
        const ratio = totalAssets.totalCount / sampleSize;

        const allMediaFolder = {
            id: 'all',
            name: 'All Media',
            album: null,
            itemCount: totalAssets.totalCount,
            photoCount: Math.round(photoCount * ratio),
            videoCount: Math.round(videoCount * ratio),
            totalCount: totalAssets.totalCount,
        };

        // Preload "All Media" if reasonable size
        if (totalAssets.totalCount < 2000) {
            loadFolderMedia('all').catch(console.warn);
        }

        return allMediaFolder;
    };

    const countMediaTypes = (assets) => {
        const photoCount = assets.filter(a => a.mediaType === MediaLibrary.MediaType.photo).length;
        const videoCount = assets.filter(a => a.mediaType === MediaLibrary.MediaType.video).length;
        return { photoCount, videoCount };
    };

    const getFolderIcon = (name, photoCount, videoCount) => {
        const normalizedName = name?.toLowerCase().replace(/\s+/g, '') || '';

        // Special cases for known folder names
        if (normalizedName.includes('camera') || normalizedName === 'camera') return 'camera-outline';
        if (normalizedName.includes('screenshot')) return 'phone-portrait-outline';
        if (normalizedName.includes('download')) return 'download-outline';
        if (normalizedName.includes('whatsapp')) return 'logo-whatsapp';
        if (normalizedName.includes('instagram')) return 'logo-instagram';
        if (normalizedName.includes('video') || normalizedName.includes('movie') || normalizedName.includes('videos')) return 'videocam-outline';
        if (normalizedName.includes('photo') || normalizedName.includes('pictures')) return 'images-outline';
        if (normalizedName === 'allmedia' || normalizedName === 'all') return 'grid-outline';

        // Determine icon based on content type
        if (photoCount > 0 && videoCount === 0) return 'images-outline';
        if (videoCount > 0 && photoCount === 0) return 'videocam-outline';
        return 'folder-outline';
    };

    const handleFolderPress = (folder) => {
        setSelectedFolder(folder);
        setShowGallery(true);
    };

    const renderFolderItem = ({ item }) => {
        const cachedStats = getFolderStats(item.id);
        const displayStats = cachedStats || {
            photoCount: item.photoCount,
            videoCount: item.videoCount,
            totalCount: item.photoCount + item.videoCount,
        };

        const description = `${displayStats.photoCount} photos • ${displayStats.videoCount} videos`;
        const cleanupStatus = cleanupProgress[item.id]?.status;

        return (
            <TouchableOpacity
                style={styles.folderContainer}
                onPress={() => handleFolderPress(item)}
                activeOpacity={0.8}
            >

                <View style={styles.iconContainer}>
                    <Ionicons
                        name={getFolderIcon(item.name, displayStats.photoCount, displayStats.videoCount)}
                        size={20}
                        color="#888"
                    />
                </View>

                <View style={styles.folderContent}>
                    <Text style={styles.folderName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.folderDescription} numberOfLines={1}>{description}</Text>
                </View>

                <View style={styles.statusContainer}>
                    

                    {cachedStats?.loaded && (
                        <View style={styles.loadedIndicator}>
                            <Ionicons name="checkmark" size={12} color="#4CAF50" />
                        </View>
                    )}

                    {cleanupStatus && (
                        <View style={[
                            styles.statusBadge,
                            cleanupStatus === 'completed' && styles.completedBadge,
                            cleanupStatus === 'in-progress' && styles.inProgressBadge
                        ]}>
                            <Ionicons
                                name={cleanupStatus === 'completed' ? 'checkmark' : 'arrow-forward'}
                                size={14}
                                color={cleanupStatus === 'completed' ? '#4CAF50' : '#FFA500'}
                            />
                        </View>
                    )}

                    <Text style={styles.itemCount}>{displayStats.totalCount}</Text>
                </View>

                
            </TouchableOpacity>
        );
    };

    if (!permissions) {
        return (
            <View style={styles.container}>
                <ActivityIndicator color="#666" size="large" />
            </View>
        );
    }

    if (!permissions.granted) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <Ionicons name="folder-open-outline" size={48} color="#666" />
                    <Text style={styles.errorText}>Media access required</Text>
                    <TouchableOpacity onPress={requestPermissions} style={styles.button}>
                        <Text style={styles.buttonText}>Grant Access</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" color="#666" />
                    <Text style={styles.loadingText}>Scanning media...</Text>
                </View>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContent}>
                    <Ionicons name="alert-circle-outline" size={48} color="#666" />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.button} onPress={loadFolders}>
                        <Text style={styles.buttonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Media</Text>
                <Text style={styles.headerSubtitle}>{folders.length} folders</Text>
            </View>

            <FlatList
                data={folders}
                keyExtractor={item => item.id}
                renderItem={renderFolderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            <FolderView
                visible={showGallery}
                folder={selectedFolder}
                onClose={() => setShowGallery(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212'
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
        marginBottom: 16,
        backgroundColor: '#181818',
        borderColor: '#55555555',
        borderBottomWidth: .75
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 2
    },
    headerSubtitle: {
        color: '#666',
        fontSize: 13
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 80
    },
    folderContainer: {
        backgroundColor: '#181818',
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 0.5,
        borderColor: '#222',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    folderContent: {
        flex: 1,
        justifyContent: 'center'
    },
    folderName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4
    },
    folderDescription: {
        color: '#888',
        fontSize: 13,
        fontWeight: '500',
        height: 20
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    itemCount: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        minWidth: 40,
        textAlign: 'right'
    },
    statusBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    completedBadge: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        borderWidth: 1,
        borderColor: '#4CAF50'
    },
    inProgressBadge: {
        backgroundColor: 'rgba(255, 165, 0, 0.2)',
        borderWidth: 1,
        borderColor: '#FFA500'
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    loadedIndicator: {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#4CAF50'
    },
    loadingText: {
        color: '#888',
        marginTop: 12,
        fontSize: 14,
        height: 20
    },
    errorText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        marginVertical: 16,
    },
    button: {
        backgroundColor: '#333',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 12
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14
    },
});