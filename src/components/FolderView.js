import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, Dimensions, Image, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useFolderMedia, useMedia } from '../contexts/MediaContext';
import CleanupModal from './CleanupModal';
import Thumbnail from './Thumbnail';
import { useHistory } from '../contexts/HistoryContext';
import AlertModal from './AlertModal';
import PreviewModal from './PreviewModal';
import { FlashList } from '@shopify/flash-list';

const { width, height } = Dimensions.get('window');

export default function FolderView({ visible, folder, onClose }) {
    // Use the media context hook
    const {
        assets: galleryAssets,
        totalCount,
        isLoaded,
        isLoading: loadingGallery,
        error,
        loadMedia
    } = useFolderMedia(folder?.id);

    const { removeAssetsFromCache, validateAsset, cleanupProgress, resetCleanupProgress } = useMedia();
    const { logDeletion } = useHistory();
    const [showBatchMenu, setShowBatchMenu] = useState(false);
    const { } = useMedia();

    // Modal States
    const [showCleanup, setShowCleanup] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertContent, setAlertContent] = useState({ title: '', message: '', onConfirm: null, onCancel: null });

    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewAsset, setPreviewAsset] = useState(null);

    const handlePreview = (asset) => {
        setPreviewAsset(asset);
        setPreviewVisible(true);
    };

    // Load media when folder changes or becomes visible
    useEffect(() => {
        if (visible && folder?.id && !isLoaded) {
            loadMedia();
        }
    }, [visible, folder?.id, isLoaded, loadMedia]);

    const getCleanupStatus = useCallback(() => {
        if (!folder?.id) return null;
        return cleanupProgress[folder.id];
    }, [folder, cleanupProgress]);

    const handleBatchDelete = async () => {
        setShowBatchMenu(false);
        try {
            await deleteAssets(galleryAssets);
            setSuccessMessage(`All ${galleryAssets.length} items deleted successfully`);
            setShowSuccessModal(true);
        } catch (error) {
            setAlertContent({
                title: 'Error',
                message: 'Failed to delete all items',
                onConfirm: () => setAlertVisible(false),
            });
            setAlertVisible(true);
        }
    };

    const handleBatchKeep = () => {
        setShowBatchMenu(false);
        setSuccessMessage(`Marked all ${galleryAssets.length} items as kept`);
        setShowSuccessModal(true);
    };

    const handleResetCleanup = () => {
        setShowBatchMenu(false);
        resetCleanupProgress(folder.id);
        setSuccessMessage('Cleanup progress reset');
        setShowSuccessModal(true);
    };

    // Success Modal Component
    function SuccessModal() {
        return (
            <Modal visible={showSuccessModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.successContainer}>
                        <View style={styles.successIconContainer}>
                            <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                        </View>

                        <Text style={styles.successTitle}>Success</Text>
                        <Text style={styles.successMessage}>{successMessage}</Text>

                        <TouchableOpacity
                            style={styles.successButton}
                            onPress={() => setShowSuccessModal(false)}
                        >
                            <Text style={styles.successButtonText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    }

    // Cleanup functions
    const startCleanup = () => {
        if (galleryAssets.length === 0) return;
        setShowCleanup(true);
    };


    const deleteAssets = async (assetsToDelete) => {
        try {
            const assetIds = assetsToDelete.map(asset => asset.id);
            await MediaLibrary.deleteAssetsAsync(assetIds);
            removeAssetsFromCache(assetIds);

            setSuccessMessage(`${assetsToDelete.length} items deleted successfully`);
            setShowSuccessModal(true);

            logDeletion({
                itemCount: assetsToDelete.length,
                folderName: folder?.name || 'Unknown',
                spaceFreed: assetsToDelete.reduce((sum, a) => sum + (a.fileSize || 0), 0),
            });
        } catch (error) {
            console.log('Deletion error:', error);
            setAlertContent({
                title: 'Error',
                message: 'Failed to delete items.',
                onConfirm: () => setAlertVisible(false),
            });
            setAlertVisible(true);
        }
    };

    const handleShowSuccess = (message) => {
        setSuccessMessage(message);
        setShowSuccessModal(true);
    };

    const renderThumbnail = useCallback(({ item, index }) => {
        const priority = index < 50 ? 'high' : 'normal';
        const lazy = index > 50;

        return (
            <Thumbnail
                item={item}
                index={index}
                onPress={() => handlePreview(item)}
                priority={priority}
                lazy={lazy}
            />
        );
    }, [handlePreview]);

    const renderingParams = useMemo(() => {
        if (galleryAssets.length === 0) {
            return {
                initialNumToRender: 25,
                maxToRenderPerBatch: 25,
                windowSize: 4
            };
        }

        // Count media types for optimization
        const videoCount = galleryAssets.filter(asset =>
            asset.mediaType === MediaLibrary.MediaType.video
        ).length;
        const videoRatio = videoCount / galleryAssets.length;

        // Optimize based on content type
        if (videoRatio >= 0.7) {
            // Video-heavy folder - conservative rendering
            return {
                initialNumToRender: 18,
                maxToRenderPerBatch: 28,
                windowSize: 3
            };
        } else if (videoRatio >= 0.3) {
            // Mixed content
            return {
                initialNumToRender: 28,
                maxToRenderPerBatch: 28,
                windowSize: 4
            };
        } else {
            // Image-heavy folder - more aggressive
            return {
                initialNumToRender: 30,
                maxToRenderPerBatch: 30,
                windowSize: 5
            };
        }
    }, [galleryAssets]);

    // Handle error state
    if (error) {
        return (
            <Modal visible={visible} animationType="slide" statusBarHidden>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                            <Ionicons name="arrow-back" size={20} color="#888" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Error</Text>
                        <View style={styles.countContainer} />
                    </View>
                    <View style={styles.loading}>
                        <Ionicons name="alert-circle-outline" size={48} color="#666" />
                        <Text style={styles.loadingText}>{error}</Text>
                        <TouchableOpacity
                            style={styles.cleanupButton}
                            onPress={() => loadMedia(true)}
                        >
                            <Text style={styles.cleanupButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </Modal>
        );
    }

    return (
        <>
            <StatusBar hidden />
            <Modal visible={visible} animationType="slide" >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.headerButton}>
                            <Ionicons name="arrow-back" size={20} color="#888" />
                        </TouchableOpacity>
                        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                            {folder?.name}
                        </Text>
                        <View style={styles.countContainer}>
                            <Text style={styles.count}>
                                {galleryAssets.length}
                                {!isLoaded && totalCount > galleryAssets.length ? `/${totalCount}` : ''}
                            </Text>
                            {loadingGallery && (
                                <ActivityIndicator
                                    size="small"
                                    color="#666"
                                    style={styles.loadingIndicator}
                                />
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={() => setShowBatchMenu(!showBatchMenu)}
                            style={styles.menuButton}
                        >
                            <Ionicons name="ellipsis-vertical" size={20} color="#888" />
                        </TouchableOpacity>
                    </View>

                    {loadingGallery && galleryAssets.length === 0 ? (
                        <View style={styles.loading}>
                            <ActivityIndicator size="large" color="#666" />
                            <Text style={styles.loadingText}>Loading media...</Text>
                        </View>
                    ) : (
                        <>
                            <FlashList
                                data={galleryAssets}
                                numColumns={4}
                                estimatedItemSize={width / 4}
                                keyExtractor={(item, index) => `${item.id}-${index}`}
                                renderItem={renderThumbnail}
                                contentContainerStyle={styles.grid}
                                showsVerticalScrollIndicator={false}
                                initialScrollIndex={0}
                                estimatedListSize={{
                                    height: height,
                                    width: width,
                                }}
                            />

                            {galleryAssets.length > 0 && (
                                <TouchableOpacity
                                    style={styles.cleanupButton}
                                    onPress={startCleanup}
                                    activeOpacity={0.95}
                                >
                                    <Ionicons name="scan-outline" size={16} color="#888" />
                                    <Text style={styles.cleanupButtonText}>Cleanup</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>

                {/* Separate Modal Components */}
                <CleanupModal
                    visible={showCleanup}
                    assets={galleryAssets}
                    onClose={() => setShowCleanup(false)}
                    onDeleteAssets={deleteAssets}
                    onShowSuccess={handleShowSuccess}
                    folderId={folder?.id}
                />

                <SuccessModal />

                <AlertModal
                    visible={alertVisible}
                    title={alertContent.title}
                    message={alertContent.message}
                    onConfirm={alertContent.onConfirm}
                    onCancel={alertContent.onCancel}
                />

                <PreviewModal
                    visible={previewVisible}
                    asset={previewAsset}
                    onClose={() => setPreviewVisible(false)}
                    fullscreen={true}
                    showControls={true}
                />

                {showBatchMenu && (
                    <View style={styles.batchMenu}>
                        <TouchableOpacity
                            style={styles.batchMenuItem}
                            onPress={handleBatchDelete}
                        >
                            <Ionicons name="trash-outline" size={18} color="#ff4444" />
                            <Text style={[styles.batchMenuText, { color: '#ff4444' }]}>Delete All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.batchMenuItem}
                            onPress={handleBatchKeep}
                        >
                            <Ionicons name="checkmark" size={18} color="#4CAF50" />
                            <Text style={[styles.batchMenuText, { color: '#4CAF50' }]}>Keep All</Text>
                        </TouchableOpacity>
                        {getCleanupStatus() && (
                            <TouchableOpacity
                                style={styles.batchMenuItem}
                                onPress={handleResetCleanup}
                            >
                                <Ionicons name="refresh" size={18} color="#888" />
                                <Text style={[styles.batchMenuText, { color: '#888' }]}>Reset Progress</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    // Main Container
    container: {
        flex: 1,
        backgroundColor: '#090909',
    },

    // Header Styles
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 20,
        borderBottomWidth: 0.5,
        borderBottomColor: '#333',
    },
    headerButton: {
        padding: 4,
        borderRadius: 4,
    },
    title: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        marginHorizontal: 12,
        height: 25
    },
    countContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    count: {
        color: '#666',
        fontSize: 13,
        fontWeight: '400',
    },
    loadingIndicator: {
        marginLeft: 6,
    },

    // Loading State
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#666',
        marginTop: 12,
        fontSize: 14,
        height: 20
    },

    // Grid View
    grid: {
        padding: 0.5,
    },
    thumbnail: {
        width: width / 5,
        height: width / 5,
        padding: 0.5,
    },
    thumbnailImage: {
        flex: 1,
        borderRadius: 1,
        backgroundColor: '#111',
    },
    videoOverlay: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 6,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Cleanup Button
    cleanupButton: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        backgroundColor: 'rgba(26,26,26,1)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    cleanupButtonText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 8,
    },

    // Modal Overlay
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Permission Modal Styles
    permissionContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 24,
        margin: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    iconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    permissionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    permissionMessage: {
        color: '#888',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 20,
    },
    permissionButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        minWidth: 80,
    },
    permissionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },

    // Success Modal Styles
    successContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 24,
        margin: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#55555555',
        minWidth: width * 0.7
    },
    successIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(76,175,80,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    successTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    successMessage: {
        color: '#888',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 20,
    },
    successButton: {
        backgroundColor: 'rgba(76,175,80,0.2)',
        borderColor: '#4CAF50',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 24,
        borderRadius: 8,
        minWidth: 80,
    },
    successButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    batchMenu: {
        position: 'absolute',
        top: 60,
        right: 16,
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#333',
        zIndex: 100,
    },
    batchMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    batchMenuText: {
        marginLeft: 12,
        fontSize: 14,
    },
    menuButton: {
        padding: 4,
    },
});