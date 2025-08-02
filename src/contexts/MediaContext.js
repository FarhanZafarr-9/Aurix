import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    CLEANUP_PROGRESS: '@MediaCleanupProgress',
    FOLDERS_METADATA: '@FoldersMetadata',
    FOLDER_ASSETS: '@FolderAssets'
};

const BATCH_SIZE = 10; // Load assets in batches

const MediaContext = createContext();

export function MediaProvider({ children }) {
    // State management
    const [foldersMetadata, setFoldersMetadata] = useState({});
    const [folderAssets, setFolderAssets] = useState({}); // { folderId: { assets: [], totalCount, cursor } }
    const [loading, setLoading] = useState({});
    const [errors, setErrors] = useState({});
    const [cleanupProgress, setCleanupProgress] = useState({});
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [sortMethod, setSortMethod] = useState('count'); // Default to count sorting

    // Load initial data from cache
    useEffect(() => {
        const loadCachedData = async () => {
            try {
                const [cachedMetadata, cachedProgress] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.FOLDERS_METADATA),
                    AsyncStorage.getItem(STORAGE_KEYS.CLEANUP_PROGRESS)
                ]);

                if (cachedMetadata) {
                    setFoldersMetadata(JSON.parse(cachedMetadata));
                }

                if (cachedProgress) {
                    const progress = JSON.parse(cachedProgress);
                    //console.log('Loaded cached progress:', progress);
                    setCleanupProgress(progress);
                }

                // Refresh if data is stale (> 1 hour old)
                const metadata = cachedMetadata ? JSON.parse(cachedMetadata) : {};
                const oldestTimestamp = Object.values(metadata).reduce((oldest, folder) => {
                    const folderTime = new Date(folder.lastUpdated).getTime();
                    return folderTime < oldest ? folderTime : oldest;
                }, Date.now());

                if (Date.now() - oldestTimestamp > 3600000) { // 1 hour
                    refreshAllData();
                }
            } catch (error) {
                console.warn('Failed to load cached data:', error);
            }
        };

        loadCachedData();
    }, []);

    // Save data when it changes - Fixed debouncing
    useEffect(() => {
        const saveData = async () => {
            try {
                /*
                console.log('Saving to AsyncStorage:', {
                    foldersCount: Object.keys(foldersMetadata).length,
                    progressCount: Object.keys(cleanupProgress).length
                });
                */

                await AsyncStorage.multiSet([
                    [STORAGE_KEYS.FOLDERS_METADATA, JSON.stringify(foldersMetadata)],
                    [STORAGE_KEYS.CLEANUP_PROGRESS, JSON.stringify(cleanupProgress)]
                ]);

                //console.log('Successfully saved to AsyncStorage');
            } catch (error) {
                console.error('Failed to save data to AsyncStorage:', error);
            }
        };

        if (Object.keys(foldersMetadata).length > 0 || Object.keys(cleanupProgress).length > 0) {
            const timeoutId = setTimeout(saveData, 100); // Reduced debounce time
            return () => clearTimeout(timeoutId);
        }
    }, [foldersMetadata, cleanupProgress]);

    // Core data fetching functions
    const getFolderMetadata = useCallback(async (album, forceRefresh = false) => {
        const cacheKey = `folder-${album.id}-metadata`;

        if (!forceRefresh && foldersMetadata[album.id]) {
            return foldersMetadata[album.id];
        }

        try {
            setLoading(prev => ({ ...prev, [cacheKey]: true }));

            // Get at least 1 photo asset to ensure we have a valid URI
            const assetsResult = await MediaLibrary.getAssetsAsync({
                album,
                first: 1,
                mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
                sortBy: MediaLibrary.SortBy.creationTime,
            });

            if (assetsResult.totalCount === 0) return null;

            // Get counts separately
            const [photoResult, videoResult] = await Promise.all([
                MediaLibrary.getAssetsAsync({
                    album,
                    first: 1,
                    mediaType: MediaLibrary.MediaType.photo
                }),
                MediaLibrary.getAssetsAsync({
                    album,
                    first: 1,
                    mediaType: MediaLibrary.MediaType.video
                })
            ]);

            const firstAsset = assetsResult.assets[0];
            if (!firstAsset) return null;

            const newMetadata = {
                id: album.id,
                name: album.title,
                totalCount: assetsResult.totalCount,
                photoCount: photoResult.totalCount,
                videoCount: videoResult.totalCount,
                firstAssetUri: firstAsset.uri,
                creationDate: firstAsset.creationTime || new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            setFoldersMetadata(prev => ({
                ...prev,
                [album.id]: newMetadata
            }));

            return newMetadata;
        } catch (error) {
            console.warn(`Failed to get metadata for ${album.title}:`, error);
            setErrors(prev => ({ ...prev, [cacheKey]: error.message }));
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, [cacheKey]: false }));
        }
    }, [foldersMetadata]);

    // Batch loading for assets - only load what we need
    const loadAssetsBatch = useCallback(async (folderId, startIndex = 0, batchSize = BATCH_SIZE) => {
        const cacheKey = `folder-${folderId}-batch-${startIndex}`;

        try {
            setLoading(prev => ({ ...prev, [cacheKey]: true }));

            const existingData = folderAssets[folderId] || { assets: [], totalCount: 0, cursor: null };

            // If we already have these assets, return them
            if (existingData.assets.length > startIndex + batchSize - 1) {
                return {
                    assets: existingData.assets.slice(startIndex, startIndex + batchSize),
                    hasMore: startIndex + batchSize < existingData.totalCount,
                    totalCount: existingData.totalCount
                };
            }

            const result = await MediaLibrary.getAssetsAsync({
                first: batchSize,
                after: existingData.cursor,
                album: folderId,
                mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
                sortBy: MediaLibrary.SortBy.creationTime,
            });

            const newAssets = [...existingData.assets, ...result.assets];

            setFolderAssets(prev => ({
                ...prev,
                [folderId]: {
                    assets: newAssets,
                    totalCount: result.totalCount,
                    cursor: result.endCursor,
                    lastUpdated: new Date().toISOString()
                }
            }));

            return {
                assets: result.assets,
                hasMore: result.hasNextPage,
                totalCount: result.totalCount
            };
        } catch (error) {
            console.warn(`Failed to load batch for folder ${folderId}:`, error);
            setErrors(prev => ({ ...prev, [cacheKey]: error.message }));
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, [cacheKey]: false }));
        }
    }, [folderAssets]);

    // Get current asset and preload next batch if needed
    const getCurrentAsset = useCallback((folderId, index) => {
        const folderData = folderAssets[folderId];
        if (!folderData || !folderData.assets[index]) {
            return null;
        }

        // Preload next batch if we're near the end of current batch
        if (index % BATCH_SIZE === BATCH_SIZE - 2 && folderData.assets.length < folderData.totalCount) {
            loadAssetsBatch(folderId, folderData.assets.length);
        }

        return folderData.assets[index];
    }, [folderAssets, loadAssetsBatch]);

    // Refresh functionality
    const refreshAllData = useCallback(async () => {
        try {
            setLoading(prev => ({ ...prev, refresh: true }));

            const albums = await MediaLibrary.getAlbumsAsync();
            const updatedMetadata = {};

            // Clear existing assets cache
            setFolderAssets({});

            await Promise.all(albums.map(async album => {
                const metadata = await getFolderMetadata(album, true);
                if (metadata) {
                    updatedMetadata[album.id] = metadata;
                }
            }));

            setFoldersMetadata(updatedMetadata);
            setLastRefreshed(new Date().toISOString());
            return updatedMetadata;
        } catch (error) {
            console.warn('Failed to refresh all data:', error);
            setErrors(prev => ({ ...prev, refresh: error.message }));
            throw error;
        } finally {
            setLoading(prev => ({ ...prev, refresh: false }));
        }
    }, [getFolderMetadata]);

    // Fixed cleanup progress management with immediate AsyncStorage saves
    const updateCleanupProgress = useCallback(async (folderId, progress) => {
        //console.log('updateCleanupProgress called:', folderId, progress);

        try {
            // Update state immediately
            const newProgress = {
                ...progress,
                lastUpdated: new Date().toISOString()
            };

            setCleanupProgress(prev => {
                const updated = {
                    ...prev,
                    [folderId]: {
                        ...prev[folderId],
                        ...newProgress
                    }
                };
                //console.log('Updated cleanup progress state:', updated);
                return updated;
            });

            // Save to AsyncStorage immediately
            const currentProgress = await AsyncStorage.getItem(STORAGE_KEYS.CLEANUP_PROGRESS);
            const allProgress = currentProgress ? JSON.parse(currentProgress) : {};

            allProgress[folderId] = {
                ...allProgress[folderId],
                ...newProgress
            };

            await AsyncStorage.setItem(STORAGE_KEYS.CLEANUP_PROGRESS, JSON.stringify(allProgress));
            //console.log('Progress saved to AsyncStorage successfully');

            return true;
        } catch (error) {
            console.error('Failed to update cleanup progress:', error);
            throw error;
        }
    }, []);

    const getCleanupProgress = useCallback((folderId) => {
        const progress = cleanupProgress[folderId] || {
            status: 'not-started',
            currentIndex: 0,
            deleteQueue: [],
            keepQueue: [],
            totalProcessed: 0
        };

        //console.log('getCleanupProgress for', folderId, ':', progress);
        return progress;
    }, [cleanupProgress]);

    const resetCleanupProgress = useCallback(async (folderId) => {
        //console.log('resetCleanupProgress called for:', folderId);

        try {
            // Update state
            setCleanupProgress(prev => {
                const updated = { ...prev };
                delete updated[folderId];
                //console.log('Reset progress state:', updated);
                return updated;
            });

            // Clear from AsyncStorage immediately
            const currentProgress = await AsyncStorage.getItem(STORAGE_KEYS.CLEANUP_PROGRESS);
            const allProgress = currentProgress ? JSON.parse(currentProgress) : {};
            delete allProgress[folderId];

            await AsyncStorage.setItem(STORAGE_KEYS.CLEANUP_PROGRESS, JSON.stringify(allProgress));
            //console.log('Progress cleared from AsyncStorage');

            // Clear folder assets cache to force reload
            setFolderAssets(prev => {
                const updated = { ...prev };
                delete updated[folderId];
                return updated;
            });

            return true;
        } catch (error) {
            console.error('Failed to reset cleanup progress:', error);
            throw error;
        }
    }, []);

    // Initialize cleanup session
    const initializeCleanup = useCallback(async (folderId) => {
        //console.log('initializeCleanup called for:', folderId);

        try {
            // Load initial batch
            await loadAssetsBatch(folderId, 0, BATCH_SIZE);

            // Get current progress from state/storage
            const currentProgress = getCleanupProgress(folderId);

            // Only initialize if truly not started
            if (currentProgress.status === 'not-started') {
                //console.log('Initializing new cleanup session');
                await updateCleanupProgress(folderId, {
                    status: 'initialized',
                    currentIndex: 0,
                    deleteQueue: [],
                    keepQueue: [],
                    totalProcessed: 0
                });
            } else {
                //console.log('Resuming existing cleanup session:', currentProgress);
            }

            return true;
        } catch (error) {
            console.error('Failed to initialize cleanup:', error);
            throw error;
        }
    }, [loadAssetsBatch, getCleanupProgress, updateCleanupProgress]);

    // Available sorting methods
    const SORT_METHODS = {
        count: {
            name: 'Item Count',
            icon: 'analytics-outline',
            sort: (a, b) => b.totalCount - a.totalCount || a.name.localeCompare(b.name)
        },
        name: {
            name: 'Name (A-Z)',
            icon: 'text-outline',
            sort: (a, b) => a.name.localeCompare(b.name)
        },
        nameDesc: {
            name: 'Name (Z-A)',
            icon: 'text-outline',
            sort: (a, b) => b.name.localeCompare(a.name)
        },
        dateCreated: {
            name: 'Date Created',
            icon: 'calendar-outline',
            sort: (a, b) => new Date(b.creationDate) - new Date(a.creationDate) || a.name.localeCompare(b.name)
        },
        dateModified: {
            name: 'Last Updated',
            icon: 'time-outline',
            sort: (a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated) || a.name.localeCompare(b.name)
        },
        size: {
            name: 'Folder Size',
            icon: 'resize-outline',
            sort: (a, b) => {
                // Approximate size based on total count (since we don't have actual folder sizes)
                const sizeA = a.totalCount * (a.videoCount > a.photoCount ? 50 : 5); // Rough MB estimate
                const sizeB = b.totalCount * (b.videoCount > b.photoCount ? 50 : 5);
                return sizeB - sizeA || a.name.localeCompare(b.name);
            }
        },
        photoCount: {
            name: 'Photo Count',
            icon: 'image-outline',
            sort: (a, b) => b.photoCount - a.photoCount || a.name.localeCompare(b.name)
        },
        videoCount: {
            name: 'Video Count',
            icon: 'videocam-outline',
            sort: (a, b) => b.videoCount - a.videoCount || a.name.localeCompare(b.name)
        }
    };

    // Helper functions
    const getAllFolders = useCallback((customSortMethod = null) => {
        const sortKey = customSortMethod || sortMethod;
        const sortFunction = SORT_METHODS[sortKey]?.sort || SORT_METHODS.count.sort;

        return Object.values(foldersMetadata).sort(sortFunction);
    }, [foldersMetadata, sortMethod]);

    const getSortMethods = useCallback(() => {
        return Object.entries(SORT_METHODS).map(([key, value]) => ({
            key,
            name: value.name,
            icon: value.icon,
            isActive: key === sortMethod
        }));
    }, [sortMethod]);

    const setSortingMethod = useCallback((method) => {
        if (SORT_METHODS[method]) {
            setSortMethod(method);
            // Save to AsyncStorage for persistence
            AsyncStorage.setItem('@SortMethod', method).catch(console.warn);
        }
    }, []);

    // Load sort method from storage on init
    useEffect(() => {
        const loadSortMethod = async () => {
            try {
                const saved = await AsyncStorage.getItem('@SortMethod');
                if (saved && SORT_METHODS[saved]) {
                    setSortMethod(saved);
                }
            } catch (error) {
                console.warn('Failed to load sort method:', error);
            }
        };
        loadSortMethod();
    }, []);

    const getFolderById = useCallback((folderId) => {
        return foldersMetadata[folderId] || null;
    }, [foldersMetadata]);

    const getFolderStats = useCallback((folderId) => {
        const folder = foldersMetadata[folderId];
        if (!folder) return null;

        return {
            totalCount: folder.totalCount,
            photoCount: folder.photoCount,
            videoCount: folder.videoCount,
            lastUpdated: folder.lastUpdated
        };
    }, [foldersMetadata]);

    const isFolderCompleted = useCallback((folderId) => {
        const progress = cleanupProgress[folderId];
        return progress && progress.status === 'completed';
    }, [cleanupProgress]);

    const clearCompletedFolder = useCallback(async (folderId) => {
        //console.log('clearCompletedFolder called for:', folderId);

        try {
            // Same logic as resetCleanupProgress but specifically for completed folders
            return await resetCleanupProgress(folderId);
        } catch (error) {
            console.error('Failed to clear completed folder:', error);
            throw error;
        }
    }, [resetCleanupProgress]);

    const getFolderCompletionStats = useCallback((folderId) => {
        const progress = cleanupProgress[folderId];
        const folder = foldersMetadata[folderId];

        if (!progress || !folder) return null;

        return {
            isCompleted: progress.status === 'completed',
            currentIndex: progress.currentIndex || 0,
            totalCount: folder.totalCount,
            itemsProcessed: progress.totalProcessed || 0,
            itemsToDelete: progress.deleteQueue?.length || 0,
            itemsToKeep: progress.keepQueue?.length || 0,
            status: progress.status || 'not-started'
        };
    }, [cleanupProgress, foldersMetadata]);

    const value = useMemo(() => ({
        // State
        foldersMetadata,
        folderAssets,
        loading,
        errors,
        cleanupProgress,
        lastRefreshed,
        sortMethod,

        // Core functions
        getFolderMetadata,
        loadAssetsBatch,
        getCurrentAsset,
        refreshAllData,

        // Cleanup management
        initializeCleanup,
        updateCleanupProgress,
        getCleanupProgress,
        resetCleanupProgress,

        // Helpers
        getAllFolders,
        getFolderById,
        getFolderStats,
        getSortMethods,
        setSortingMethod,
        isFolderCompleted,
        getFolderCompletionStats,
        clearCompletedFolder,
        isFolderCompleted,
        getFolderCompletionStats,
        SORT_METHODS,
    }), [
        foldersMetadata,
        folderAssets,
        loading,
        errors,
        cleanupProgress,
        lastRefreshed,
        sortMethod,
        getFolderMetadata,
        loadAssetsBatch,
        getCurrentAsset,
        refreshAllData,
        initializeCleanup,
        updateCleanupProgress,
        getCleanupProgress,
        resetCleanupProgress,
        clearCompletedFolder,
        getAllFolders,
        getFolderById,
        getFolderStats,
        getSortMethods,
        setSortingMethod,
        isFolderCompleted,
        getFolderCompletionStats
    ]);

    return (
        <MediaContext.Provider value={value}>
            {children}
        </MediaContext.Provider>
    );
}

export function useMedia() {
    const context = useContext(MediaContext);
    if (!context) throw new Error('useMedia must be used within MediaProvider');
    return context;
}

export function useFolder(folderId) {
    const {
        getFolderById,
        getCleanupProgress,
        loading,
        errors
    } = useMedia();

    return {
        folder: getFolderById(folderId),
        progress: getCleanupProgress(folderId),
        isLoading: loading[`folder-${folderId}-metadata`],
        error: errors[`folder-${folderId}-metadata`]
    };
}