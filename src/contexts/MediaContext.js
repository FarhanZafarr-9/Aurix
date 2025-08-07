import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSetting, SETTINGS_KEYS } from '../utils/Settings';
import { useTheme } from './ThemeContext';

const STORAGE_KEYS = {
    COMPLETED_FOLDERS: '@CompletedFolders', // Simple completion tracking
    CURRENT_SESSION: '@CurrentCleanupSession', // Only current session data
    FOLDERS_METADATA: '@FoldersMetadata',
    FOLDER_ASSETS: '@FolderAssets'
};

const BATCH_SIZE = 10;

const MediaContext = createContext();

export function MediaProvider({ children }) {
    const { sortMethod, updateSortMethod } = useTheme();
    // State management
    const [foldersMetadata, setFoldersMetadata] = useState({});
    const [folderAssets, setFolderAssets] = useState({});
    const [loading, setLoading] = useState({});
    const [errors, setErrors] = useState({});
    const [lastRefreshed, setLastRefreshed] = useState(null);

    // Simplified completion tracking - just folder IDs and basic info
    const [completedFolders, setCompletedFolders] = useState({}); // { folderId: { completedAt, itemsDeleted, totalItems } }

    // Current session only - gets cleared when session ends
    const [currentSession, setCurrentSession] = useState({
        folderId: null,
        deleteQueue: [],
        keepQueue: [],
        currentIndex: 0
    });

    // Load initial data from cache
    useEffect(() => {
        const loadCachedData = async () => {
            try {
                const [cachedMetadata, cachedCompleted] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.FOLDERS_METADATA),
                    AsyncStorage.getItem(STORAGE_KEYS.COMPLETED_FOLDERS)
                ]);

                if (cachedMetadata) {
                    setFoldersMetadata(JSON.parse(cachedMetadata));
                }

                if (cachedCompleted) {
                    const completed = JSON.parse(cachedCompleted);
                    console.log('Loaded completed folders:', completed);
                    setCompletedFolders(completed);
                }

                // Load current session if exists (user might have closed app mid-cleanup)
                const currentSessionData = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
                if (currentSessionData) {
                    const session = JSON.parse(currentSessionData);
                    console.log('Resuming session:', session);
                    setCurrentSession(session);
                }
            } catch (error) {
                console.warn('Failed to load cached data:', error);
            }
        };

        loadCachedData();
    }, []);

    // Save completion data when it changes
    useEffect(() => {
        const saveCompletionData = async () => {
            try {
                await AsyncStorage.setItem(STORAGE_KEYS.COMPLETED_FOLDERS, JSON.stringify(completedFolders));
            } catch (error) {
                console.error('Failed to save completion data:', error);
            }
        };

        if (Object.keys(completedFolders).length > 0) {
            const timeoutId = setTimeout(saveCompletionData, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [completedFolders]);

    // Save current session data
    useEffect(() => {
        const saveSession = async () => {
            try {
                if (currentSession.folderId) {
                    await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(currentSession));
                } else {
                    // Clear session if no active folder
                    await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
                }
            } catch (error) {
                console.error('Failed to save session:', error);
            }
        };

        const timeoutId = setTimeout(saveSession, 100);
        return () => clearTimeout(timeoutId);
    }, [currentSession]);

    const getFolderMetadata = useCallback(async (album, forceRefresh = false) => {
        const cacheKey = `folder-${album.id}-metadata`;
        const existingMetadata = foldersMetadata[album.id];

        if (!forceRefresh && existingMetadata && (existingMetadata.totalSize || existingMetadata.isSkipped)) {
            return existingMetadata;
        }

        try {
            setLoading(prev => ({ ...prev, [cacheKey]: true, status: 'metadata' }));

            const assetsResult = await MediaLibrary.getAssetsAsync({
                album: album.id,
                first: 1,
                mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
            });

            if (assetsResult.totalCount === 0) return null;

            const firstAsset = assetsResult.assets[0];
            const baseMetadata = {
                id: album.id,
                name: album.title,
                totalCount: album.assetCount || assetsResult.totalCount,
                firstAssetUri: firstAsset?.uri,
                creationDate: firstAsset?.creationTime || new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                totalSize: 0,
                isSkipped: false,
            };

            const folderItemLimit = await getSetting(SETTINGS_KEYS.FOLDER_ITEM_LIMIT);
            if (folderItemLimit > 0 && baseMetadata.totalCount > folderItemLimit) {
                baseMetadata.isSkipped = true;
                setFoldersMetadata(prev => ({ ...prev, [album.id]: baseMetadata }));
                return baseMetadata;
            }

            // Fetch counts in parallel
            const [photoResult, videoResult] = await Promise.all([
                MediaLibrary.getAssetsAsync({ album: album.id, mediaType: 'photo' }),
                MediaLibrary.getAssetsAsync({ album: album.id, mediaType: 'video' })
            ]);
            baseMetadata.photoCount = photoResult.totalCount;
            baseMetadata.videoCount = videoResult.totalCount;

            // Calculate total size
            setLoading(prev => ({ ...prev, [cacheKey]: true, status: 'sizing' }));

            const calculateSizeForType = async (mediaType) => {
                let size = 0;
                let assetsPage = await MediaLibrary.getAssetsAsync({
                    album: album.id,
                    first: 100,
                    mediaType: mediaType
                });

                while (assetsPage.assets.length > 0) {
                    const fileInfos = await Promise.all(
                        assetsPage.assets.map(asset => FileSystem.getInfoAsync(asset.uri, { size: true }))
                    );
                    size += fileInfos.reduce((sum, info) => sum + (info.exists ? info.size : 0), 0);

                    if (assetsPage.hasNextPage) {
                        assetsPage = await MediaLibrary.getAssetsAsync({
                            album: album.id,
                            first: 100,
                            after: assetsPage.endCursor,
                            mediaType: mediaType
                        });
                    } else {
                        break;
                    }
                }
                return size;
            };

            const photoSize = await calculateSizeForType(MediaLibrary.MediaType.photo);
            const videoSize = await calculateSizeForType(MediaLibrary.MediaType.video);
            baseMetadata.totalSize = photoSize + videoSize;

            setFoldersMetadata(prev => ({ ...prev, [album.id]: baseMetadata }));
            return baseMetadata;

        } catch (error) {
            console.warn(`Failed to get metadata for ${album.title}:`, error);
            setErrors(prev => ({ ...prev, [cacheKey]: error.message }));
            return null; // Return null on error
        } finally {
            setLoading(prev => ({ ...prev, [cacheKey]: false, status: null }));
        }
    }, [foldersMetadata]);

    const refreshAllData = useCallback(async (forceRefresh = false) => {
        try {
            setLoading({ all: true, status: 'folders', progress: 0, total: 0, loaded: 0 });
            setErrors({});

            const albums = await MediaLibrary.getAlbumsAsync();
            const total = albums.length;
            setLoading(prev => ({ ...prev, total }));

            let loaded = 0;
            const newMetadata = {};

            for (const album of albums) {
                const metadata = await getFolderMetadata(album, forceRefresh);
                if (metadata) {
                    newMetadata[album.id] = metadata;
                }
                loaded++;
                setLoading(prev => ({
                    ...prev,
                    progress: loaded / total,
                    loaded,
                    status: `Processing ${loaded}/${total}...`
                }));
                // Update metadata state incrementally
                setFoldersMetadata(prevMetadata => ({ ...prevMetadata, ...newMetadata }));
                // Give the UI a chance to update
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            setLastRefreshed(new Date().toISOString());
            AsyncStorage.setItem(STORAGE_KEYS.FOLDERS_METADATA, JSON.stringify(foldersMetadata));

        } catch (error) {
            console.warn('Failed to refresh all data:', error);
            setErrors(prev => ({ ...prev, all: error.message }));
        } finally {
            setLoading(prev => ({ ...prev, all: false, status: null }));
        }
    }, [getFolderMetadata, foldersMetadata]);
	    const loadAssetsBatch = useCallback(async (folderId, startIndex = 0, customBatchSize = null) => {
        const cacheKey = `folder-${folderId}-batch-${startIndex}`;

        try {
            setLoading(prev => ({ ...prev, [cacheKey]: true }));

            let batchSize = BATCH_SIZE;
            if (customBatchSize) {
                batchSize = customBatchSize;
            } else {
                try {
                    const cleanupSettings = await AsyncStorage.getItem('@CleanupSettings');
                    if (cleanupSettings) {
                        const settings = JSON.parse(cleanupSettings);
                        const batchSizeMap = {
                            small: 5,
                            medium: 10,
                            large: 20,
                            xlarge: 50
                        };
                        batchSize = batchSizeMap[settings.batchSize] || BATCH_SIZE;
                    }
                } catch (error) {
                    console.warn('Failed to get batch size from settings:', error);
                }
            }

            const existingData = folderAssets[folderId] || { assets: [], totalCount: 0, cursor: null };

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

    const getCurrentAsset = useCallback(async (folderId, index) => {
        const folderData = folderAssets[folderId];
        if (!folderData || !folderData.assets[index]) {
            return null;
        }

        // Preload logic unchanged
        let batchSize = BATCH_SIZE;
        try {
            const cleanupSettings = await AsyncStorage.getItem('@CleanupSettings');
            if (cleanupSettings) {
                const settings = JSON.parse(cleanupSettings);
                const batchSizeMap = {
                    small: 5,
                    medium: 10,
                    large: 20,
                    xlarge: 50
                };
                batchSize = batchSizeMap[settings.batchSize] || BATCH_SIZE;
            }
        } catch (error) {
            console.warn('Failed to get batch size for preloading:', error);
        }

        if (index % batchSize === batchSize - 2 && folderData.assets.length < folderData.totalCount) {
            loadAssetsBatch(folderId, folderData.assets.length);
        }

        return folderData.assets[index];
    }, [folderAssets, loadAssetsBatch]);


    // SIMPLIFIED CLEANUP FUNCTIONS

    // Start or resume a cleanup session
    const startCleanupSession = useCallback(async (folderId) => {
        console.log('Starting cleanup session for folder:', folderId);

        // Load initial batch
        await loadAssetsBatch(folderId, 0, BATCH_SIZE);

        // Check if resuming existing session
        if (currentSession.folderId === folderId && currentSession.currentIndex > 0) {
            console.log('Resuming existing session at index:', currentSession.currentIndex);
            return currentSession;
        }

        // Start new session
        const newSession = {
            folderId,
            deleteQueue: [],
            keepQueue: [],
            currentIndex: 0
        };

        setCurrentSession(newSession);
        return newSession;
    }, [loadAssetsBatch, currentSession]);

    // Update current session (called as user makes decisions)
    const updateCurrentSession = useCallback((updates) => {
        console.log('Updating session:', updates);
        setCurrentSession(prev => ({ ...prev, ...updates }));
    }, []);

    // Complete cleanup session and mark folder as completed
    const completeCleanupSession = useCallback(async () => {
        if (!currentSession.folderId) {
            console.warn('No active session to complete');
            return;
        }

        console.log('Completing cleanup session for folder:', currentSession.folderId);

        const folderId = currentSession.folderId;
        const folder = foldersMetadata[folderId];

        if (!folder) {
            console.error('Folder not found for completion:', folderId);
            return;
        }

        // Mark folder as completed
        const completionData = {
            completedAt: new Date().toISOString(),
            itemsDeleted: currentSession.deleteQueue.length,
            itemsKept: currentSession.keepQueue.length,
            totalItems: folder.totalCount
        };

        setCompletedFolders(prev => ({
            ...prev,
            [folderId]: completionData
        }));

        console.log('Folder marked as completed:', folderId, completionData);

        // Return delete queue for actual deletion
        const deleteQueue = [...currentSession.deleteQueue];

        // Clear current session
        setCurrentSession({
            folderId: null,
            deleteQueue: [],
            keepQueue: [],
            currentIndex: 0
        });

        return deleteQueue;
    }, [currentSession, foldersMetadata]);

    // Clear completion status (for re-evaluation)
    const clearFolderCompletion = useCallback(async (folderId) => {
        console.log('Clearing completion for folder:', folderId);

        setCompletedFolders(prev => {
            const updated = { ...prev };
            delete updated[folderId];
            return updated;
        });

        // Also clear any current session for this folder
        if (currentSession.folderId === folderId) {
            setCurrentSession({
                folderId: null,
                deleteQueue: [],
                keepQueue: [],
                currentIndex: 0
            });
        }

        // Clear folder assets cache to force reload
        setFolderAssets(prev => {
            const updated = { ...prev };
            delete updated[folderId];
            return updated;
        });
    }, [currentSession]);

    // Check if folder is completed
    const isFolderCompleted = useCallback((folderId) => {
        return !!completedFolders[folderId];
    }, [completedFolders]);

    // Get folder completion info
    const getFolderCompletionInfo = useCallback((folderId) => {
        const completion = completedFolders[folderId];
        if (!completion) return null;

        return {
            isCompleted: true,
            completedAt: completion.completedAt,
            itemsDeleted: completion.itemsDeleted,
            itemsKept: completion.itemsKept,
            totalItems: completion.totalItems
        };
    }, [completedFolders]);

    // Get current session info
    const getCurrentSessionInfo = useCallback(() => {
        return currentSession;
    }, [currentSession]);

    // Check if folder has active session
    const hasActiveSession = useCallback((folderId) => {
        return currentSession.folderId === folderId && currentSession.currentIndex > 0;
    }, [currentSession]);

    // Sorting functions (unchanged)
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
            sort: (a, b) => (b.totalSize || 0) - (a.totalSize || 0) || a.name.localeCompare(b.name)
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

    const getAllFolders = useCallback(() => {
        const sortFunction = SORT_METHODS[sortMethod]?.sort || SORT_METHODS.count.sort;
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

    const value = useMemo(() => ({
        // State
        foldersMetadata,
        folderAssets,
        loading,
        errors,
        lastRefreshed,

        // Core functions
        getFolderMetadata,
        loadAssetsBatch,
        getCurrentAsset,
        refreshAllData,

        // Simplified cleanup management
        startCleanupSession,
        updateCurrentSession,
        completeCleanupSession,
        clearFolderCompletion,
        getCurrentSessionInfo,

        // Completion checking
        isFolderCompleted,
        getFolderCompletionInfo,
        hasActiveSession,

        // Helpers
        getAllFolders,
        getFolderById,
        getFolderStats,
        getSortMethods,
    }), [
        foldersMetadata,
        folderAssets,
        loading,
        errors,
        lastRefreshed,
        getFolderMetadata,
        loadAssetsBatch,
        getCurrentAsset,
        refreshAllData,
        startCleanupSession,
        updateCurrentSession,
        completeCleanupSession,
        clearFolderCompletion,
        getCurrentSessionInfo,
        isFolderCompleted,
        getFolderCompletionInfo,
        hasActiveSession,
        getAllFolders,
        getFolderById,
        getFolderStats,
        getSortMethods,
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
        getCurrentSessionInfo,
        isFolderCompleted,
        hasActiveSession,
        loading,
        errors
    } = useMedia();

    return {
        folder: getFolderById(folderId),
        isCompleted: isFolderCompleted(folderId),
        hasActiveSession: hasActiveSession(folderId),
        currentSession: getCurrentSessionInfo(),
        isLoading: loading[`folder-${folderId}-metadata`],
        error: errors[`folder-${folderId}-metadata`]
    };
}