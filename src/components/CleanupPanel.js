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
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';
import MetadataModal from './MetadataModal';
import * as FileSystem from 'expo-file-system';
import { useMedia } from '../contexts/MediaContext';
import { useTheme } from '../contexts/ThemeContext';
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 80;
const MEDIA_HEIGHT = height * 0.72;

function VideoPlayer({ uri, isActive, style }) {
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
            style={style}
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
    const { colors, autoBackup } = useTheme();
    const {
        getCurrentAsset,
        loadAssetsBatch,
        getFolderById,
        startCleanupSession,
        updateCurrentSession,
        completeCleanupSession,
        getCurrentSessionInfo,
        clearFolderCompletion
    } = useMedia();

    const [showMetadata, setShowMetadata] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [fileSize, setFileSize] = useState(null);
    const [loadedAssets, setLoadedAssets] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeVideoIndex, setActiveVideoIndex] = useState(null);
    const [pendingIndex, setPendingIndex] = useState(null);


    // Get current session state
    const currentSession = getCurrentSessionInfo();
    const currentIndex = currentSession.currentIndex || 0;
    const deleteQueue = currentSession.deleteQueue || [];
    const keepQueue = currentSession.keepQueue || [];


    // Animation refs for stack effect
    const currentTranslateX = useRef(new Animated.Value(0)).current;
    const currentScale = useRef(new Animated.Value(1)).current;
    const currentOpacity = useRef(new Animated.Value(1)).current;
    const nextScale = useRef(new Animated.Value(0.95)).current;
    const nextOpacity = useRef(new Animated.Value(0.8)).current;

    const folder = getFolderById(folderId);
    const navigation = useNavigation();

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
        },
        loadingText: {
            color: colors.textSecondary,
            marginTop: 12,
            fontSize: 14,
            height: 20
        },
        emptyContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: colors.background,
            padding: 24,
        },
        emptyTitle: {
            color: colors.text,
            fontSize: 24,
            fontWeight: '600',
            marginTop: 16,
            marginBottom: 8,
            height: 30
        },
        emptySubtitle: {
            color: colors.textSecondary,
            fontSize: 16,
            marginBottom: 24,
            height: 25
        },
        doneButton: {
            backgroundColor: colors.card,
            minWidth: 200,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 0.75,
            borderColor: colors.border,
            alignItems: 'center',
        },
        doneButtonText: {
            color: colors.text,
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
            borderBottomColor: colors.border,
            position: 'relative',
        },
        headerButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
        },
        progressContainer: {
            flex: 1,
            alignItems: 'center',
            marginHorizontal: 16,
        },
        progressText: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 4,
        },
        progressBar: {
            width: '100%',
            height: 3,
            backgroundColor: colors.card,
            borderRadius: 2,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            backgroundColor: colors.textSecondary,
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
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
        },
        deleteNowButton: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
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
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
        },
        menuDropdown: {
            position: 'absolute',
            top: 80,
            right: 16,
            backgroundColor: colors.surface,
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
            color: colors.text,
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
            backgroundColor: colors.card,
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
            backgroundColor: colors.card,
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
            color: colors.text,
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
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
        },
    }), [colors]);

    // Initialize cleanup session
    useEffect(() => {
        const initialize = async () => {
            if (!folderId) return;

            try {
                setLoading(true);
                console.log('Starting cleanup session for folder:', folderId);

                const session = await startCleanupSession(folderId);
                console.log('Session started/resumed:', session);

                // Load initial batch
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

    // Control video playback
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

    const animateToNext = useCallback((direction, onFinished) => {
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
            })
        ]).start(() => {
            resetAnimations();
            onFinished?.();
        });
    }, [currentTranslateX, currentOpacity, resetAnimations]);


    const handleNextAsset = useCallback((shouldDelete) => {
        const currentAsset = loadedAssets[currentIndex];
        if (!currentAsset) return;

        const newIndex = currentIndex + 1;
        setPendingIndex(newIndex);

        if (shouldDelete) {
            deleteQueue.push(currentAsset);
        } else {
            keepQueue.push(currentAsset);
        }

        animateToNext(shouldDelete ? 'delete' : 'keep', async () => {
            if (autoBackup) {
                updateCurrentSession({
                    currentIndex: newIndex,
                    deleteQueue,
                    keepQueue
                });
            }
            setPendingIndex(null);

            if (newIndex >= totalCount) {
                await completeCleanup();
            }
        });
    }, [currentIndex, loadedAssets, deleteQueue, keepQueue, animateToNext, autoBackup, updateCurrentSession, completeCleanup]);


    // Complete cleanup and call onComplete
    const completeCleanup = useCallback(async () => {
        console.log('Completing cleanup session');

        try {
            const deletionQueue = await completeCleanupSession();
            console.log('Session completed, items to delete:', deletionQueue?.length || 0);

            if (onComplete) {
                onComplete(deletionQueue || []);
            }
        } catch (error) {
            console.error('Failed to complete cleanup:', error);
        }
    }, [completeCleanupSession, onComplete]);

    // Undo functionality
    const handleUndo = useCallback(async () => {
        if (currentIndex === 0) return;

        const prevIndex = currentIndex - 1;
        const prevAsset = loadedAssets[prevIndex];

        if (!prevAsset) return;

        // Remove from queues
        const newDeleteQueue = deleteQueue.filter(a => a.id !== prevAsset.id);
        const newKeepQueue = keepQueue.filter(a => a.id !== prevAsset.id);

        // Update session
        if (autoBackup) {
            updateCurrentSession({
                currentIndex: prevIndex,
                deleteQueue: newDeleteQueue,
                keepQueue: newKeepQueue
            });
        }

        resetAnimations();
    }, [currentIndex, loadedAssets, deleteQueue, keepQueue, updateCurrentSession, resetAnimations, autoBackup]);

    const handleMarkAllAsKeep = useCallback(async () => {
        const remainingAssets = loadedAssets.slice(currentIndex);
        const newKeepQueue = [...keepQueue, ...remainingAssets];

        // Update session
        if (autoBackup) {
            updateCurrentSession({
                currentIndex: totalCount,
                deleteQueue: [],
                keepQueue: newKeepQueue
            });
        }

        setShowMenu(false);
        completeCleanup();
    }, [currentIndex, loadedAssets, totalCount, keepQueue, updateCurrentSession, completeCleanup, autoBackup]);

    const handleMarkAllAsDelete = useCallback(async () => {
        const remainingAssets = loadedAssets.slice(currentIndex);
        const newDeleteQueue = [...deleteQueue, ...remainingAssets];

        // Update session
        if (autoBackup) {
            updateCurrentSession({
                currentIndex: totalCount,
                deleteQueue: newDeleteQueue,
                keepQueue: []
            });
        }

        setShowMenu(false);
        completeCleanup();
    }, [currentIndex, loadedAssets, totalCount, deleteQueue, updateCurrentSession, completeCleanup, autoBackup]);

    const handleResetProgress = useCallback(async () => {
        try {
            await clearFolderCompletion(folderId);
            setShowMenu(false);
            resetAnimations();

            // Reload initial state
            const session = await startCleanupSession(folderId);
            const batch = await loadAssetsBatch(folderId, 0, 10);
            setLoadedAssets(batch.assets);
            setTotalCount(batch.totalCount);
        } catch (error) {
            console.error('Failed to reset progress:', error);
        }
    }, [folderId, clearFolderCompletion, resetAnimations, startCleanupSession, loadAssetsBatch]);

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
                        style={styles.media}
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
    }, [activeVideoIndex, currentIndex, styles.mediaContainer, styles.media]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.textSecondary} />
                <Text style={styles.loadingText}>Preparing cleanup...</Text>
            </View>
        );
    }

    const currentAsset = loadedAssets[currentIndex];
    const nextAsset = pendingIndex === null ? loadedAssets[currentIndex + 1] : null;


    if (currentIndex >= totalCount) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle" size={64} color="#4CAF50" />
                <Text style={styles.emptyTitle}>Cleanup Complete!</Text>
                <Text style={styles.emptySubtitle}>
                    {deleteQueue.length > 0
                        ? `${deleteQueue.length} items queued for deletion`
                        : 'All items reviewed - no deletions needed'
                    }
                </Text>
                <TouchableOpacity
                    style={styles.doneButton}
                    onPress={completeCleanup}
                >
                    <Text style={styles.doneButtonText}>
                        {deleteQueue.length > 0 ? 'Delete & Done' : 'Done'}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header with menu */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
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
                            <Ionicons name="arrow-undo" size={18} color={colors.textSecondary} />
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
                        <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
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
                            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
                            <Text style={styles.menuItemText}>Reset Progress</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Media Stack Container */}
            <View style={styles.mediaStack}>
                {/* Next card (behind) */}
                {nextAsset && (
                    <Animated.View
                        style={[
                            styles.mediaCard,
                            styles.nextCard,
                            {
                                transform: [{ scale: nextScale }],
                                opacity: nextOpacity,
                                zIndex: 1,
                            }
                        ]}
                        pointerEvents="none"
                    >
                        {renderMedia(nextAsset)}
                    </Animated.View>
                )}

                {/* Current card (front) */}
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
                            zIndex: 2,
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
                    <Ionicons name="information-circle" size={20} color={colors.textSecondary} />
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
