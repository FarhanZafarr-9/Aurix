import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Image, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useState, useRef, useEffect, useCallback } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';
import AlertModal from './AlertModal';
import { useMedia } from '../contexts/MediaContext';
import MetadataModal from './MetadataModal';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

function VideoPlayer({ uri, isActive }) {
    const player = useVideoPlayer(uri, (p) => {
        p.isLooping = false;
    });

    useEffect(() => {
        if (!player) return;

        // Only call if player is still valid
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
            style={styles.cleanupMedia}
            contentFit="contain"
            nativeControls={true}
        />
    );
}

export default function CleanupModal({
    visible,
    assets,
    onClose,
    onDeleteAssets,
    onShowSuccess,
    folderId
}) {
    const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
    const [deleteQueue, setDeleteQueue] = useState([]);
    const [keepQueue, setKeepQueue] = useState([]);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertContent, setAlertContent] = useState({ title: '', message: '', onConfirm: null, onCancel: null });
    const { cleanupProgress, updateCleanupProgress, resetCleanupProgress } = useMedia();
    const [showMetadata, setShowMetadata] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [fileSize, setFileSize] = useState(null);

    useEffect(() => {
        if (!selectedAsset) {
            setFileSize(null);
            return;
        }

        let isMounted = true;

        const loadInfo = async () => {
            try {
                const info = await FileSystem.getInfoAsync(selectedAsset.uri);
                if (isMounted) {
                    setFileSize(info.size ?? null);
                }
            } catch (e) {
                console.warn('Failed to get file size', e);
                if (isMounted) setFileSize(null);
            }
        };

        loadInfo();

        return () => { isMounted = false };
    }, [selectedAsset]);



    useEffect(() => {
        if (visible && folderId) {
            const progress = cleanupProgress[folderId];
            if (progress) {
                setCurrentAssetIndex(progress.index);
                setDeleteQueue(progress.deleteQueue || []);
                setKeepQueue(progress.keepQueue || []);
            } else {
                setCurrentAssetIndex(0);
                setDeleteQueue([]);
                setKeepQueue([]);
            }
        }
    }, [visible, folderId]);

    // Animation refs
    const translateX = useRef(new Animated.Value(0)).current;
    const nextTranslateX = useRef(new Animated.Value(width)).current;
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    // Reset animations when asset changes
    useEffect(() => {
        translateX.setValue(0);
        nextTranslateX.setValue(width);
        scale.setValue(1);
        opacity.setValue(1);
    }, [currentAssetIndex]);

    const showAssetMetadata = useCallback((asset) => {
        setSelectedAsset(asset);
        setShowMetadata(true);
    }, []);

    // Enhanced share handler with asset validation
    const handleShare = async (asset) => {
        try {
            if (!(await Sharing.isAvailableAsync())) {
                setShowPermissionModal(true);
                return;
            }

            const hasPermission = await requestSharingPermission();
            if (!hasPermission) {
                setShowPermissionModal(true);
                return;
            }

            // Get asset info without EXIF to avoid permission issues
            const assetInfo = await MediaLibrary.getAssetInfoAsync(asset, {
                shouldDownloadFromNetwork: true,
            });

            if (assetInfo.localUri || assetInfo.uri) {
                await Sharing.shareAsync(assetInfo.localUri || assetInfo.uri, {
                    mimeType: assetInfo.mediaType === 'video' ? 'video/*' : 'image/*',
                });
            }
        } catch (error) {
            console.log('Sharing error:', error);
            if (error.message?.includes('Asset not found') || error.message?.includes('deleted')) {
                setAlertContent({
                    title: 'Error',
                    message: 'This media file no longer exists',
                    onConfirm: () => setAlertVisible(false),
                });
                setAlertVisible(true);

            } else if (error.message?.includes('ACCESS_MEDIA_LOCATION')) {
                setAlertContent({
                    title: 'Permission Required',
                    message: 'Location permission is needed to share photos with location data. Share without location?',
                    onConfirm: async () => {
                        setAlertVisible(false);
                        const assetInfo = await MediaLibrary.getAssetInfoAsync(asset);
                        if (assetInfo.localUri || assetInfo.uri) {
                            await Sharing.shareAsync(assetInfo.localUri || assetInfo.uri);
                        }
                    },
                    onCancel: () => setAlertVisible(false),
                });
                setAlertVisible(true);

            } else {
                setAlertContent({
                    title: 'Error',
                    message: 'Failed to share Media',
                    onConfirm: () => setAlertVisible(false),
                });
                setAlertVisible(true);
            }
        }
    };

    const saveProgress = useCallback(() => {
        if (!folderId) return;

        updateCleanupProgress(folderId, {
            index: currentAssetIndex,
            deleteQueue,
            keepQueue,
            status: currentAssetIndex >= assets.length ? 'completed' :
                currentAssetIndex > 0 ? 'in-progress' : 'not-started'
        });
    }, [folderId, currentAssetIndex, deleteQueue, keepQueue, assets]);

    const handleNextAsset = (shouldDelete) => {
        const currentAsset = assets[currentAssetIndex];

        if (shouldDelete && currentAsset) {
            setDeleteQueue(prev => [...prev, currentAsset]);
        } else if (currentAsset) {
            setKeepQueue(prev => [...prev, currentAsset]);
        }

        const newIndex = currentAssetIndex + 1;
        setCurrentAssetIndex(newIndex);

        // Save progress after each action
        saveProgress();

        if (newIndex >= assets.length) {
            completeCleanup();
        }
    };

    const completeCleanup = () => {
        onClose();
        if (deleteQueue.length > 0) {
            setAlertContent({
                title: 'Cleanup Complete',
                message: `${deleteQueue.length} items selected for deletion`,
                onConfirm: () => {
                    onDeleteAssets(deleteQueue);
                    resetCleanupProgress(folderId);
                    setAlertVisible(false);
                },
                onCancel: () => {
                    resetCleanupProgress(folderId);
                    setAlertVisible(false);
                },
            });
            setAlertVisible(true);
        } else {
            onShowSuccess('Cleanup completed - no items selected for deletion');
            resetCleanupProgress(folderId);
        }
    };

    const handleEarlyDelete = () => {
        if (deleteQueue.length === 0) {
            onClose();
            return;
        }

        setAlertContent({
            title: 'Delete Selected Items?',
            message: `You're about to delete ${deleteQueue.length} items. Continue?`,
            onConfirm: () => {
                onDeleteAssets(deleteQueue);
                saveProgress(); // Save before closing
                onClose();
                setAlertVisible(false);
            },
            onCancel: () => setAlertVisible(false),
        });
        setAlertVisible(true);
    };

    const handleReset = () => {
        setAlertContent({
            title: 'Start Over?',
            message: 'This will reset your progress and you\'ll need to review all items again.',
            onConfirm: () => {
                setCurrentAssetIndex(0);
                setDeleteQueue([]);
                setKeepQueue([]);
                resetCleanupProgress(folderId);
                setAlertVisible(false);
            },
            onCancel: () => setAlertVisible(false),
        });
        setAlertVisible(true);
    };

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
            Animated.spring(scale, {
                toValue: 0.95,
                useNativeDriver: true,
            }).start();
        },
        onPanResponderMove: (evt, gestureState) => {
            translateX.setValue(gestureState.dx);
            if (Math.abs(gestureState.dx) > 50) {
                nextTranslateX.setValue(gestureState.dx > 0 ? width - gestureState.dx : -width - gestureState.dx);
            }
            opacity.setValue(1 - Math.min(Math.abs(gestureState.dx) / 200, 0.3));
        },
        onPanResponderRelease: (evt, gestureState) => {
            Animated.spring(scale, {
                toValue: 1,
                useNativeDriver: true,
            }).start();

            if (gestureState.dx > 120) {
                handleNextAsset(false);
            } else if (gestureState.dx < -120) {
                handleNextAsset(true);
            } else {
                Animated.parallel([
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                    }),
                    Animated.spring(nextTranslateX, {
                        toValue: width,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 200,
                        useNativeDriver: true,
                    })
                ]).start();
            }
        },
    });

    const animatedStyle = {
        transform: [
            { translateX: translateX },
            { scale: scale }
        ],
        opacity: opacity
    };

    const nextAnimatedStyle = {
        transform: [
            { translateX: nextTranslateX }
        ],
    };

    const currentAsset = assets[currentAssetIndex];
    const nextAssetPreview = assets[currentAssetIndex + 1];

    const renderActionButtons = () => (
        <View style={[styles.actionButtonsContainer, { gap: 10 }]}>

            <>
                {currentAssetIndex > 0 ? (
                    <>
                        <TouchableOpacity
                            style={[styles.actionButtonSmall, styles.deleteButton]}
                            onPress={handleEarlyDelete}
                            disabled={deleteQueue.length === 0}
                        >
                            <Ionicons name="trash-outline" size={18} color="#ff4444" />

                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButtonSmall, styles.resetButton]}
                            onPress={handleReset}
                        >
                            <Ionicons name="refresh" size={18} color="#888" />
                        </TouchableOpacity>
                    </>
                ) : (
                    <Text style={styles.instructionText}>
                        No Progress
                    </Text>
                )}
            </>
        </View>
    );

    const renderMedia = useCallback((asset, isActive = false) => {
        if (!asset) return null;
        if (asset.mediaType === MediaLibrary.MediaType.video) {
            return <VideoPlayer key={asset.id} uri={asset.uri} isActive={isActive} />;
        }

        return (
            <Image
                source={{ uri: asset.uri }}
                style={styles.cleanupMedia}
                resizeMode="contain"
            />
        );
    }, []);

    if (!visible || assets.length === 0) return null;

    return (
        <Modal visible={visible} animationType="fade">
            <View style={styles.cleanupContainer}>
                <View style={styles.cleanupHeader}>
                    <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                        <Ionicons name="close" size={22} color="#888" />
                    </TouchableOpacity>
                    <Text style={[styles.cleanupProgress, { marginLeft: 40 }]}>
                        {currentAssetIndex + 1} of {assets.length}
                    </Text>

                    {renderActionButtons()}
                </View>

                {deleteQueue.length > 0 && (
                    <View style={styles.cleanupQueue}>
                        <Text style={styles.cleanupQueueText}>
                            {deleteQueue.length} items queued for deletion
                        </Text>
                        <TouchableOpacity
                            style={[styles.actionButtonSmall, styles.deleteButton, { minWidth: 100, paddingVertical: 6 }]}
                            onPress={() => {
                                onDeleteAssets(deleteQueue);
                                onClose();
                            }}
                        >
                            <Text style={styles.deleteNowText}>Delete Now</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.cleanupImageContainer}>
                    <Animated.View
                        style={[styles.cleanupMediaWrapper, animatedStyle]}
                        {...panResponder.panHandlers}
                    >
                        {renderMedia(currentAsset, true)}
                    </Animated.View>

                    {nextAssetPreview && (
                        <Animated.View
                            style={[
                                styles.cleanupMediaWrapper,
                                {
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                },
                                nextAnimatedStyle
                            ]}
                        >
                            {renderMedia(nextAssetPreview)}
                        </Animated.View>
                    )}
                </View>

                <View style={styles.cleanupButtons}>
                    {/* Delete Button (Left Arrow) */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.deleteButton]}
                        onPress={() => handleNextAsset(true)}
                    >
                        <Ionicons name="arrow-back" size={24} color="#ff4444" />
                        <Text style={[styles.actionButtonText, { color: '#ff4444' }]}>Delete</Text>
                    </TouchableOpacity>

                    {/* Undo Button (Only icon) */}
                    {currentAssetIndex > 0 && (
                        <TouchableOpacity
                            style={[styles.actionButtonIcon, styles.undoButton]}
                            onPress={() => {
                                // Go back to previous asset
                                const prevIndex = currentAssetIndex - 1;
                                setCurrentAssetIndex(prevIndex);

                                // Remove from appropriate queue
                                const prevAsset = assets[prevIndex];
                                if (deleteQueue.includes(prevAsset)) {
                                    setDeleteQueue(deleteQueue.filter(a => a.id !== prevAsset.id));
                                } else {
                                    setKeepQueue(keepQueue.filter(a => a.id !== prevAsset.id));
                                }
                            }}
                        >
                            <Ionicons name="arrow-undo" size={24} color="#FFA500" />
                        </TouchableOpacity>
                    )}

                    {/* Metadata Button (Only icon) */}
                    <TouchableOpacity
                        style={[styles.actionButtonIcon, styles.metadataButton]}
                        onPress={() => {
                            setSelectedAsset(currentAsset);
                            setShowMetadata(true);
                        }}
                    >
                        <Ionicons name="information-circle" size={24} color="#4285F4" />
                    </TouchableOpacity>

                    {/* Keep Button (Right Arrow) */}
                    <TouchableOpacity
                        style={[styles.actionButton, styles.keepButton]}
                        onPress={() => handleNextAsset(false)}
                    >
                        <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>Keep</Text>
                        <Ionicons name="arrow-forward" size={24} color="#4CAF50" />
                    </TouchableOpacity>
                    </View>
                </View>

            <AlertModal
                visible={alertVisible}
                title={alertContent.title}
                message={alertContent.message}
                onConfirm={alertContent.onConfirm}
                onCancel={alertContent.onCancel}
            />

            <MetadataModal
                visible={showMetadata}
                asset={selectedAsset}
                onClose={() => setShowMetadata(false)}
                onShare={handleShare}
                fileSize={fileSize}
            />

        </Modal>
    );
}

const styles = StyleSheet.create({
    cleanupContainer: {
        flex: 1,
        backgroundColor: '#090909',
    },
    cleanupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 0.5,
        borderBottomColor: '#333',
    },
    headerButton: {
        padding: 4,
        borderRadius: 4,
    },
    cleanupProgress: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cleanupQueue: {
        backgroundColor: '#181818',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    cleanupQueueText: {
        color: '#fff',
        fontSize: 14,
        height: 20
    },

    deleteNowText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    cleanupImageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    cleanupMediaWrapper: {
        width: width - 40,
        height: height * 0.6,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#101010',
    },
    cleanupMedia: {
        width: '100%',
        height: '100%',
    },
    instructionText: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
        fontWeight: 'bold',
        height: 20
    },
    cleanupButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        minWidth: 120,
        borderWidth: 1,
    },
    actionButtonIcon: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
    },
    deleteButton: {
        backgroundColor: 'rgba(255,68,68,0.1)',
        borderColor: '#ff4444',
    },
    keepButton: {
        backgroundColor: 'rgba(76,175,80,0.1)',
        borderColor: '#4CAF50',
    },
    undoButton: {
        backgroundColor: 'rgba(255,165,0,0.1)',
        borderColor: '#FFA500',
    },
    metadataButton: {
        backgroundColor: 'rgba(66,133,244,0.1)',
        borderColor: '#4285F4',
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '500',
        marginHorizontal: 8,
    },
});