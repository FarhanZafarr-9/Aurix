import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CLEANUP_STORAGE_KEY = '@MediaCleanupProgress';

const MediaContext = createContext();

export function MediaProvider({ children }) {
    // Media state
    const [folderMedia, setFolderMedia] = useState({});
    const [loading, setLoading] = useState({});
    const [errors, setErrors] = useState({});
    const [cleanupProgress, setCleanupProgress] = useState({});

    // Load cleanup progress on startup
    useEffect(() => {
        const loadProgress = async () => {
            try {
                const saved = await AsyncStorage.getItem(CLEANUP_STORAGE_KEY);
                if (saved) setCleanupProgress(JSON.parse(saved));
            } catch (e) {
                console.warn('Failed to load cleanup progress:', e);
            }
        };
        loadProgress();
    }, []);

    // Save cleanup progress when it changes
    useEffect(() => {
        // In the saveProgress function inside the useEffect:
        const saveProgress = async () => {
            try {
                // Only store essential data with proper null checks
                const minimalProgress = Object.entries(cleanupProgress).reduce((acc, [folderId, progress]) => {
                    if (!progress) return acc;

                    acc[folderId] = {
                        i: progress.index || 0, // default to 0 if undefined
                        d: progress.deleteQueue?.map(a => a.id) || [], // safe array mapping
                        k: progress.keepQueue?.map(a => a.id) || [], // safe array mapping
                        s: progress.status || 'not-started' // default status
                    };
                    return acc;
                }, {});

                await AsyncStorage.setItem(CLEANUP_STORAGE_KEY, JSON.stringify(minimalProgress));
            } catch (e) {
                console.warn('Failed to save cleanup progress:', e);
            }
        };

        if (Object.keys(cleanupProgress).length > 0) {
            saveProgress();
        }
    }, [cleanupProgress]);

    const updateCleanupProgress = useCallback((folderId, progress) => {
        setCleanupProgress(prev => ({
            ...prev,
            [folderId]: {
                ...prev[folderId],
                ...progress,
                // Keep existing queues if not provided
                deleteQueue: progress.deleteQueue || prev[folderId]?.deleteQueue || [],
                keepQueue: progress.keepQueue || prev[folderId]?.keepQueue || []
            }
        }));
    }, []);

    const resetCleanupProgress = useCallback(async (folderId) => {
        setCleanupProgress(prev => {
            const newState = { ...prev };
            delete newState[folderId];
            return newState;
        });

        try {
            const current = await AsyncStorage.getItem(CLEANUP_STORAGE_KEY);
            if (current) {
                const parsed = JSON.parse(current);
                delete parsed[folderId];
                await AsyncStorage.setItem(CLEANUP_STORAGE_KEY, JSON.stringify(parsed));
            }
        } catch (e) {
            console.warn('Failed to reset cleanup progress:', e);
        }
    }, []);

    // Optimized media loading with batching
    const loadFolderMedia = useCallback(async (folderId, forceReload = false) => {
        if (!forceReload && folderMedia[folderId]?.loaded) {
            return folderMedia[folderId];
        }

        setLoading(prev => ({ ...prev, [folderId]: true }));
        setErrors(prev => ({ ...prev, [folderId]: null }));

        try {
            let allAssets = [];
            let hasNextPage = true;
            let endCursor = null;

            // Initial batch
            const firstBatch = await MediaLibrary.getAssetsAsync({
                first: 50,
                album: folderId === 'all' ? undefined : folderId,
                mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
                sortBy: MediaLibrary.SortBy.creationTime,
            });

            allAssets = firstBatch.assets;
            hasNextPage = firstBatch.hasNextPage;
            endCursor = firstBatch.endCursor;

            // Update UI quickly with first batch
            setFolderMedia(prev => ({
                ...prev,
                [folderId]: {
                    assets: allAssets,
                    totalCount: firstBatch.totalCount,
                    hasNextPage,
                    endCursor,
                    loaded: true,
                    lastUpdated: Date.now()
                }
            }));

            // Load remaining in background
            while (hasNextPage && endCursor) {
                const batch = await MediaLibrary.getAssetsAsync({
                    first: 300,
                    after: endCursor,
                    album: folderId === 'all' ? undefined : folderId,
                    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
                    sortBy: MediaLibrary.SortBy.creationTime,
                });

                allAssets = [...allAssets, ...batch.assets];
                hasNextPage = batch.hasNextPage;
                endCursor = batch.endCursor;

                // Update state with new assets
                setFolderMedia(prev => ({
                    ...prev,
                    [folderId]: {
                        ...prev[folderId],
                        assets: allAssets,
                        hasNextPage,
                        endCursor,
                        lastUpdated: Date.now()
                    }
                }));
            }

            setLoading(prev => ({ ...prev, [folderId]: false }));
            return { assets: allAssets, totalCount: firstBatch.totalCount, loaded: true };

        } catch (error) {
            console.warn(`Error loading folder ${folderId}:`, error);
            setErrors(prev => ({ ...prev, [folderId]: error.message || 'Failed to load' }));
            setLoading(prev => ({ ...prev, [folderId]: false }));
            throw error;
        }
    }, [folderMedia]);

    // Optimized asset removal
    const removeAssetsFromCache = useCallback((assetIds) => {
        const deletedIds = new Set(assetIds);
        setFolderMedia(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(folderId => {
                if (updated[folderId]?.assets) {
                    updated[folderId] = {
                        ...updated[folderId],
                        assets: updated[folderId].assets.filter(a => !deletedIds.has(a.id)),
                        totalCount: Math.max(0, updated[folderId].totalCount - assetIds.length)
                    };
                }
            });
            return updated;
        });
    }, []);

    // Other context methods remain the same as before
    const getFolderMedia = useCallback((folderId) => folderMedia[folderId] || null, [folderMedia]);
    const isFolderLoaded = useCallback((folderId) => folderMedia[folderId]?.loaded || false, [folderMedia]);
    const isFolderLoading = useCallback((folderId) => loading[folderId] || false, [loading]);
    const getFolderError = useCallback((folderId) => errors[folderId] || null, [errors]);
    const clearCache = useCallback(() => {
        setFolderMedia({});
        setLoading({});
        setErrors({});
    }, []);

    const validateAsset = useCallback(async (asset) => {
        try {
            await MediaLibrary.getAssetInfoAsync(asset.id);
            return true;
        } catch {
            removeAssetsFromCache([asset.id]);
            return false;
        }
    }, [removeAssetsFromCache]);

    const getFolderStats = useCallback((folderId) => {
        const folder = folderMedia[folderId];
        if (!folder) return null;

        const photos = folder.assets.filter(a => a.mediaType === MediaLibrary.MediaType.photo).length;
        const videos = folder.assets.filter(a => a.mediaType === MediaLibrary.MediaType.video).length;

        return {
            totalCount: folder.totalCount,
            photoCount: photos,
            videoCount: videos,
            loaded: folder.loaded
        };
    }, [folderMedia]);

    const value = useMemo(() => ({
        // State
        folderMedia,
        loading,
        errors,
        cleanupProgress,

        // Actions
        loadFolderMedia,
        removeAssetsFromCache,
        getFolderMedia,
        isFolderLoaded,
        isFolderLoading,
        getFolderError,
        clearCache,
        validateAsset,
        getFolderStats,
        updateCleanupProgress,
        resetCleanupProgress
    }), [
        folderMedia,
        loading,
        errors,
        cleanupProgress,
        loadFolderMedia,
        removeAssetsFromCache,
        getFolderMedia,
        isFolderLoaded,
        isFolderLoading,
        getFolderError,
        clearCache,
        validateAsset,
        getFolderStats,
        updateCleanupProgress,
        resetCleanupProgress
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

export function useFolderMedia(folderId) {
    const { getFolderMedia, isFolderLoaded, isFolderLoading, getFolderError, loadFolderMedia } = useMedia();
    const folderData = getFolderMedia(folderId);

    return {
        assets: folderData?.assets || [],
        totalCount: folderData?.totalCount || 0,
        isLoaded: isFolderLoaded(folderId),
        isLoading: isFolderLoading(folderId),
        error: getFolderError(folderId),
        loadMedia: (forceReload = false) => loadFolderMedia(folderId, forceReload)
    };
}