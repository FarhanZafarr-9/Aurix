import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Animated,
    PanResponder,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';
import MetadataModal from './MetadataModal';
import * as FileSystem from 'expo-file-system';
import { useMedia } from '../contexts/MediaContext';
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const MEDIA_HEIGHT = height * 0.72;

function VideoPlayer({ uri, isActive }) {
    const player = useVideoPlayer(uri, (p) => {
        p.isLooping = false;
        p.muted = true;
    });

    useEffect(() => {
        if (!player) return;

        try {
            if (isActive) {
                player.play();
            } else {
                player.pause();
                player.seekTo(0);
            }
        } catch {
            console.warn('Player method call failed—possibly released');
        }

        return () => {
            try {
                player.pause();
                player.seekTo(0);
            } catch {
                /* no-op if already released */
            }
        };
    }, [player, isActive]);

    if (!player) return null;

    return (
        <VideoView
            player={player}
            style={styles.media}
            contentFit="contain"
            nativeControls={true}
        />
    );
}

export default function CleanupPanel({
    folderId,
    onComplete,
    onClose,
    route
}) {
    const {
        getCurrentAsset,
        loadAssetsBatch,
        getCleanupProgress,
        updateCleanupProgress,
        resetCleanupProgress,
        getFolderById,
        initializeCleanup
    } = useMedia();

    const [currentIndex, setCurrentIndex] = useState(0);
    const [deleteQueue, setDeleteQueue] = useState([]);
    const [keepQueue, setKeepQueue] = useState([]);
    const [showMetadata, setShowMetadata] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [fileSize, setFileSize] = useState(null);
    const [loadedAssets, setLoadedAssets] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeVideoIndex, setActiveVideoIndex] = useState(null);

    // Animation refs for stack effect
    const currentTranslateX = useRef(new Animated.Value(0)).current;
    const currentScale = useRef(new Animated.Value(1)).current;
    const currentOpacity = useRef(new Animated.Value(1)).current;
    const nextScale = useRef(new Animated.Value(0.95)).current;
    const nextOpacity = useRef(new Animated.Value(0.8)).current;

    const folder = getFolderById(folderId);
    const navigation = useNavigation();

    // Progress update with proper async handling
    const saveProgressToContext = useCallback(async (newProgress) => {
        try {
            await updateCleanupProgress(folderId, newProgress);
            //console.log('Progress saved:', newProgress);
        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    }, [folderId, updateCleanupProgress]);

    useEffect(() => {
        let isMounted = true;

        const resetState = async () => {
            if (isMounted) {
                setCurrentIndex(0);
                setDeleteQueue([]);
                setKeepQueue([]);
                setLoadedAssets([]);
                setTotalCount(0);
                setLoading(true);

                try {
                    await resetCleanupProgress(folderId);
                    const batch = await loadAssetsBatch(folderId, 0, 10);
                    if (isMounted) {
                        setLoadedAssets(batch.assets);
                        setTotalCount(batch.totalCount);
                    }
                } catch (error) {
                    console.error('Failed to reset:', error);
                } finally {
                    if (isMounted) {
                        setLoading(false);
                    }
                }
            }
        };

        if (route.params?.reset) {
            resetState();
            navigation.setParams({ reset: undefined });
        }

        return () => {
            isMounted = false;
        };
    }, [route.params?.reset]);

    // Initialize cleanup and load first batch
    useEffect(() => {
        const initialize = async () => {
            if (!folderId) return;

            try {
                setLoading(true);
                await initializeCleanup(folderId);

                // Get progress from context
                const progress = getCleanupProgress(folderId);
                console.log('Loaded progress:', progress);

                setCurrentIndex(progress.currentIndex || 0);
                setDeleteQueue(progress.deleteQueue || []);
                setKeepQueue(progress.keepQueue || []);

                const batch = await loadAssetsBatch(folderId, 0, 10);
                setLoadedAssets(batch.assets);
                setTotalCount(batch.totalCount);
            } catch (error) {
                console.error('Failed to initialize cleanup:', error);
            } finally {
                setLoading(false);
            }
        };

        initialize();
    }, [folderId]);

    // Load more assets as needed
    useEffect(() => {
        const loadMoreIfNeeded = async () => {
            if (currentIndex >= loadedAssets.length - 2 && loadedAssets.length < totalCount) {
                try {
                    const batch = await loadAssetsBatch(folderId, loadedAssets.length, 10);
                    setLoadedAssets(prev => [...prev, ...batch.assets]);
                } catch (error) {
                    console.error('Failed to load more assets:', error);
                }
            }
        };

        loadMoreIfNeeded();
    }, [currentIndex, loadedAssets.length, totalCount]);

    // Control video playback - only play current video
    useEffect(() => {
        const currentAsset = loadedAssets[currentIndex];
        if (currentAsset && currentAsset.mediaType === MediaLibrary.MediaType.video) {
            setActiveVideoIndex(currentIndex);
        } else {
            setActiveVideoIndex(null);
        }
    }, [currentIndex, loadedAssets]);

    // Get file size for metadata
    useEffect(() => {
        if (!selectedAsset) {
            setFileSize(null);
            return;
        }

        const loadInfo = async () => {
            try {
                const info = await FileSystem.getInfoAsync(selectedAsset.uri);
                setFileSize(info.size ?? null);
            } catch (e) {
                console.warn('Failed to get file size', e);
                setFileSize(null);
            }
        };

        loadInfo();
    }, [selectedAsset]);

    const MAX_SIZE_MB = 50;

    async function shareMediaCopy(uri) {
        try {
            if (!uri.startsWith('file://')) {
                console.warn('Only file:// URIs are supported for sharing');
                return;
            }

            const info = await FileSystem.getInfoAsync(uri);
            if (!info.exists) {
                console.warn('File does not exist:', uri);
                return;
            }

            const sizeMB = info.size / (1024 * 1024);
            if (sizeMB > MAX_SIZE_MB) {
                console.warn(`File too large to share (${sizeMB.toFixed(2)}MB > ${MAX_SIZE_MB}MB)`);
                return;
            }

            const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
            const tempUri = FileSystem.cacheDirectory + `shared_temp.${extension}`;

            await FileSystem.copyAsync({ from: uri, to: tempUri });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(tempUri);
            } else {
                console.warn('Sharing not available on this device');
            }

            await FileSystem.deleteAsync(tempUri, { idempotent: true });

        } catch (error) {
            console.error('Failed to share media:', error);
        }
    }

    const resetAnimations = useCallback(() => {
        currentTranslateX.setValue(0);
        currentScale.setValue(1);
        currentOpacity.setValue(1);
        nextScale.setValue(0.95);
        nextOpacity.setValue(0.8);
    }, [currentTranslateX, currentScale, currentOpacity, nextScale, nextOpacity]);

    const animateToNext = useCallback((direction) => {
        const toValue = direction === 'delete' ? -width : width;

        Animated.parallel([
            Animated.timing(currentTranslateX, {
                toValue,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(currentOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.spring(nextScale, {
                toValue: 1,
                tension: 100,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.timing(nextOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => {
            // Reset animations for next card
            resetAnimations();
        });
    }, [currentTranslateX, currentOpacity, nextScale, nextOpacity, resetAnimations]);

    // Fixed handleNextAsset with proper progress saving
    const handleNextAsset = useCallback(async (shouldDelete) => {
        const currentAsset = loadedAssets[currentIndex];
        if (!currentAsset) return;

        const newIndex = currentIndex + 1;
        let newDeleteQueue = deleteQueue;
        let newKeepQueue = keepQueue;

        // Update queues
        if (shouldDelete) {
            newDeleteQueue = [...deleteQueue, currentAsset];
            setDeleteQueue(newDeleteQueue);
        } else {
            newKeepQueue = [...keepQueue, currentAsset];
            setKeepQueue(newKeepQueue);
        }

        // Update index
        setCurrentIndex(newIndex);

        // Save progress immediately with all current state
        const progressData = {
            currentIndex: newIndex,
            deleteQueue: newDeleteQueue,
            keepQueue: newKeepQueue,
            totalProcessed: newDeleteQueue.length + newKeepQueue.length,
            status: newIndex >= totalCount ? 'completed' :
                newIndex > 0 ? 'in-progress' : 'initialized'
        };

        console.log('Saving progress:', progressData);
        await saveProgressToContext(progressData);

        // Animate
        animateToNext(shouldDelete ? 'delete' : 'keep');

        // Check completion
        if (newIndex >= totalCount) {
            // Mark as completed before triggering completion
            setTimeout(async () => {
                await saveProgressToContext({
                    currentIndex: totalCount,
                    deleteQueue: newDeleteQueue,
                    keepQueue: newKeepQueue,
                    totalProcessed: newDeleteQueue.length + newKeepQueue.length,
                    status: 'completed'
                });
                completeCleanup();
            }, 300);
        }
    }, [currentIndex, loadedAssets, totalCount, animateToNext, deleteQueue, keepQueue, saveProgressToContext]);

    const completeCleanup = useCallback(async () => {
        // Mark folder as completed before deletion
        await saveProgressToContext({
            currentIndex: totalCount,
            deleteQueue,
            keepQueue,
            totalProcessed: deleteQueue.length + keepQueue.length,
            status: 'completed'
        });

        if (deleteQueue.length > 0) {
            onComplete(deleteQueue);
        } else {
            // No items to delete, just mark as completed
            onComplete([]);
        }
    }, [deleteQueue, keepQueue, totalCount, onComplete, saveProgressToContext]);

    // Fixed undo functionality with proper animation reset
    const handleUndo = useCallback(async () => {
        if (currentIndex === 0) return;

        const prevIndex = currentIndex - 1;
        const prevAsset = loadedAssets[prevIndex];

        if (!prevAsset) return;

        // Remove from queues
        const newDeleteQueue = deleteQueue.filter(a => a.id !== prevAsset.id);
        const newKeepQueue = keepQueue.filter(a => a.id !== prevAsset.id);

        setDeleteQueue(newDeleteQueue);
        setKeepQueue(newKeepQueue);
        setCurrentIndex(prevIndex);

        // Save progress
        const progressData = {
            currentIndex: prevIndex,
            deleteQueue: newDeleteQueue,
            keepQueue: newKeepQueue,
            totalProcessed: newDeleteQueue.length + newKeepQueue.length,
            status: prevIndex === 0 ? 'initialized' : 'in-progress'
        };

        await saveProgressToContext(progressData);

        // Reset animations properly
        resetAnimations();
    }, [currentIndex, loadedAssets, deleteQueue, keepQueue, saveProgressToContext, resetAnimations]);

    // Menu actions
    const handleMarkAllAsKeep = useCallback(async () => {
        const remainingAssets = loadedAssets.slice(currentIndex);
        const newKeepQueue = [...keepQueue, ...remainingAssets];

        setKeepQueue(newKeepQueue);
        setCurrentIndex(totalCount);
        setShowMenu(false);

        // Save progress
        await saveProgressToContext({
            currentIndex: totalCount,
            deleteQueue,
            keepQueue: newKeepQueue,
            totalProcessed: deleteQueue.length + newKeepQueue.length,
            status: 'completed'
        });

        completeCleanup();
    }, [loadedAssets, currentIndex, totalCount, keepQueue, deleteQueue, saveProgressToContext, completeCleanup]);

    const handleMarkAllAsDelete = useCallback(async () => {
        const remainingAssets = loadedAssets.slice(currentIndex);
        const newDeleteQueue = [...deleteQueue, ...remainingAssets];

        setDeleteQueue(newDeleteQueue);
        setCurrentIndex(totalCount);
        setShowMenu(false);

        // Save progress
        await saveProgressToContext({
            currentIndex: totalCount,
            deleteQueue: newDeleteQueue,
            keepQueue,
            totalProcessed: newDeleteQueue.length + keepQueue.length,
            status: 'completed'
        });

        completeCleanup();
    }, [loadedAssets, currentIndex, totalCount, deleteQueue, keepQueue, saveProgressToContext, completeCleanup]);

    const handleResetProgress = useCallback(async () => {
        setCurrentIndex(0);
        setDeleteQueue([]);
        setKeepQueue([]);
        setShowMenu(false);

        await resetCleanupProgress(folderId);
        resetAnimations();
    }, [folderId, resetCleanupProgress, resetAnimations]);

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
            return Math.abs(gestureState.dx) > 10;
        },
        onPanResponderGrant: () => {
            Animated.spring(currentScale, {
                toValue: 0.98,
                useNativeDriver: true,
            }).start();
        },
        onPanResponderMove: (_, gestureState) => {
            currentTranslateX.setValue(gestureState.dx);

            const progress = Math.min(Math.abs(gestureState.dx) / SWIPE_THRESHOLD, 1);
            nextScale.setValue(0.95 + (0.05 * progress));
            nextOpacity.setValue(0.8 + (0.2 * progress));
            currentOpacity.setValue(1 - (progress * 0.3));
        },
        onPanResponderRelease: (_, gestureState) => {
            Animated.spring(currentScale, {
                toValue: 1,
                useNativeDriver: true,
            }).start();

            if (gestureState.dx > SWIPE_THRESHOLD) {
                handleNextAsset(false); // Keep
            } else if (gestureState.dx < -SWIPE_THRESHOLD) {
                handleNextAsset(true); // Delete
            } else {
                // Reset to original position
                Animated.parallel([
                    Animated.spring(currentTranslateX, {
                        toValue: 0,
                        useNativeDriver: true,
                    }),
                    Animated.spring(nextScale, {
                        toValue: 0.95,
                        useNativeDriver: true,
                    }),
                    Animated.timing(nextOpacity, {
                        toValue: 0.8,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(currentOpacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    })
                ]).start();
            }
        },
    });

    const renderMedia = useCallback((asset, style = {}, isCurrentAsset = false) => {
        if (!asset) return null;

        if (asset.mediaType === MediaLibrary.MediaType.video) {
            return (
                <View style={[styles.mediaContainer, style]}>
                    <VideoPlayer
                        uri={asset.uri}
                        isActive={isCurrentAsset && activeVideoIndex === currentIndex}
                    />
                </View>
            );
        }

        return (
            <View style={[styles.mediaContainer, style]}>
                <Image
                    source={{ uri: asset.uri }}
                    style={styles.media}
                    resizeMode="contain"
                />
            </View>
        );
    }, [activeVideoIndex, currentIndex]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#666" />
                <Text style={styles.loadingText}>Preparing cleanup...</Text>
            </View>
        );
    }

    const currentAsset = loadedAssets[currentIndex];
    const nextAsset = loadedAssets[currentIndex + 1];

    if (currentIndex >= totalCount) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                <Text style={styles.emptyTitle}>Cleanup Complete!</Text>
                <Text style={styles.emptySubtitle}>
                    {deleteQueue.length} items queued for deletion
                </Text>
                <TouchableOpacity
                    style={styles.doneButton}
                    onPress={completeCleanup}
                >
                    <Text style={styles.doneButtonText}>Delete & Done</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header with menu */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                    <Ionicons name="close" size={20} color="#8E8E93" />
                </TouchableOpacity>

                <View style={styles.progressContainer}>
                    <Text style={styles.progressText}>
                        {currentIndex + 1} / {totalCount}
                    </Text>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${((currentIndex + 1) / totalCount) * 100}%` }
                            ]}
                        />
                    </View>
                </View>

                <View style={styles.headerActions}>
                    {currentIndex > 0 && (
                        <TouchableOpacity onPress={handleUndo} style={styles.undoButton}>
                            <Ionicons name="arrow-undo" size={18} color="#8E8E93" />
                        </TouchableOpacity>
                    )}

                    {deleteQueue.length > 0 && (
                        <TouchableOpacity
                            onPress={completeCleanup}
                            style={styles.deleteNowButton}
                        >
                            <Text style={styles.deleteNowText}>{deleteQueue.length}</Text>
                            <Ionicons name="trash" size={16} color="#FF6B6B" />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.menuButton}>
                        <Ionicons name="ellipsis-vertical" size={18} color="#8E8E93" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Dropdown Menu */}
            {showMenu && (
                <View style={styles.menuDropdown}>
                    <TouchableOpacity onPress={handleMarkAllAsKeep} style={styles.menuItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.menuItemText}>Mark All as Keep</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleMarkAllAsDelete} style={styles.menuItem}>
                        <Ionicons name="trash" size={20} color="#FF6B6B" />
                        <Text style={styles.menuItemText}>Mark All as Delete</Text>
                    </TouchableOpacity>
                    {(deleteQueue.length > 0 || keepQueue.length > 0) && (
                        <TouchableOpacity onPress={handleResetProgress} style={styles.menuItem}>
                            <Ionicons name="refresh" size={20} color="#8E8E93" />
                            <Text style={styles.menuItemText}>Reset Progress</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Media Stack Container - Fixed Z-index issues */}
            <View style={styles.mediaStack}>
                {/* Next card (behind) - Always render behind current */}
                {nextAsset && (
                    <Animated.View
                        style={[
                            styles.mediaCard,
                            styles.nextCard,
                            {
                                transform: [{ scale: nextScale }],
                                opacity: nextOpacity,
                                zIndex: 1, // Always behind current
                            }
                        ]}
                        pointerEvents="none" // Prevent touch interference
                    >
                        {renderMedia(nextAsset)}
                    </Animated.View>
                )}

                {/* Current card (front) - Always on top */}
                <Animated.View
                    style={[
                        styles.mediaCard,
                        styles.currentCard,
                        {
                            transform: [
                                { translateX: currentTranslateX },
                                { scale: currentScale }
                            ],
                            opacity: currentOpacity,
                            zIndex: 2, // Always on top
                        }
                    ]}
                    {...panResponder.panHandlers}
                >
                    {renderMedia(currentAsset, {}, true)}

                    {/* Swipe Indicators */}
                    <Animated.View
                        style={[
                            styles.swipeIndicator,
                            styles.deleteIndicator,
                            {
                                opacity: currentTranslateX.interpolate({
                                    inputRange: [-100, -SWIPE_THRESHOLD, 0],
                                    outputRange: [1, 0.7, 0],
                                    extrapolate: 'clamp',
                                }),
                            }
                        ]}
                    >
                        <Ionicons name="trash" size={32} color="#FF6B6B" />
                        <Text style={styles.swipeText}>Delete</Text>
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.swipeIndicator,
                            styles.keepIndicator,
                            {
                                opacity: currentTranslateX.interpolate({
                                    inputRange: [0, SWIPE_THRESHOLD, 100],
                                    outputRange: [0, 0.7, 1],
                                    extrapolate: 'clamp',
                                }),
                            }
                        ]}
                    >
                        <Ionicons name="checkmark" size={32} color="#4CAF50" />
                        <Text style={styles.swipeText}>Keep</Text>
                    </Animated.View>
                </Animated.View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionContainer}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.deleteActionButton]}
                    onPress={() => handleNextAsset(true)}
                >
                    <Ionicons name="close" size={24} color="#FF6B6B" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.infoButton}
                    onPress={() => {
                        setSelectedAsset(currentAsset);
                        setShowMetadata(true);
                    }}
                >
                    <Ionicons name="information-circle" size={20} color="#8E8E93" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.keepActionButton]}
                    onPress={() => handleNextAsset(false)}
                >
                    <Ionicons name="checkmark" size={24} color="#4CAF50" />
                </TouchableOpacity>
            </View>

            <MetadataModal
                visible={showMetadata}
                asset={selectedAsset}
                onClose={() => setShowMetadata(false)}
                onShare={() => shareMediaCopy(selectedAsset.uri)}
                fileSize={fileSize}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
    },
    loadingText: {
        color: '#8E8E93',
        marginTop: 12,
        fontSize: 14,
        height: 20
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
        padding: 24,
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 8,
        height: 30
    },
    emptySubtitle: {
        color: '#8E8E93',
        fontSize: 16,
        marginBottom: 24,
        height: 25
    },
    doneButton: {
        backgroundColor: '#ffffff08',
        minWidth: 200,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 0.75,
        borderColor: '#38383A',
        alignItems: 'center',
    },
    doneButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#1C1C1E',
        position: 'relative',
    },
    headerButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1C1C1E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressContainer: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 16,
    },
    progressText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    progressBar: {
        width: '100%',
        height: 3,
        backgroundColor: '#1C1C1E',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#8E8E93',
        borderRadius: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    undoButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1C1C1E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deleteNowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    deleteNowText: {
        color: '#FF6B6B',
        fontSize: 12,
        fontWeight: '600',
    },
    menuButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1C1C1E',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuDropdown: {
        position: 'absolute',
        top: 80,
        right: 16,
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        paddingVertical: 8,
        minWidth: 180,
        zIndex: 1000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
    },
    menuItemText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
    },
    mediaStack: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    mediaCard: {
        width: width - 32,
        height: MEDIA_HEIGHT,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1C1C1E',
    },
    currentCard: {
        // No position needed, just ensure proper zIndex
    },
    nextCard: {
        position: 'absolute',
        // Positioned absolutely behind current card
    },
    mediaContainer: {
        flex: 1,
        backgroundColor: '#1C1C1E',
    },
    media: {
        width: '100%',
        height: '100%',
    },
    swipeIndicator: {
        position: 'absolute',
        top: '50%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 16,
        padding: 16,
        marginTop: -40,
    },
    deleteIndicator: {
        left: 32,
    },
    keepIndicator: {
        right: 32,
    },
    swipeText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 8,
    },
    actionContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 32,
        paddingVertical: 20,
        paddingBottom: 32,
    },
    actionButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    deleteActionButton: {
        backgroundColor: 'rgba(255,107,107,0.1)',
        borderColor: '#FF6B6B',
    },
    keepActionButton: {
        backgroundColor: 'rgba(76,175,80,0.1)',
        borderColor: '#4CAF50',
    },
    infoButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#1C1C1E',
        alignItems: 'center',
        justifyContent: 'center',
    },
});