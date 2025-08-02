import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Dimensions,
    Animated,
    PanResponder,
    StatusBar,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef } from 'react';

const { width, height } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = height * 0.7;
const HANDLE_HEIGHT = 24;

export default function MetadataModal({ visible, asset, onClose, onShare, fileSize = null }) {
    const translateY = useRef(new Animated.Value(BOTTOM_SHEET_HEIGHT)).current;
    const backdropOpacity = useRef(new Animated.Value(0)).current;

    const panResponder = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
            return Math.abs(gestureState.dy) > 5;
        },
        onPanResponderMove: (_, gestureState) => {
            if (gestureState.dy > 0) {
                translateY.setValue(gestureState.dy);
            }
        },
        onPanResponderRelease: (_, gestureState) => {
            if (gestureState.dy > 100 || gestureState.vy > 0.5) {
                closeModal();
            } else {
                Animated.spring(translateY, {
                    toValue: 0,
                    tension: 100,
                    friction: 8,
                    useNativeDriver: true,
                }).start();
            }
        },
    });

    useEffect(() => {
        if (visible) {
            showModal();
        } else {
            hideModal();
        }
    }, [visible]);

    const showModal = () => {
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                tension: 100,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const hideModal = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: BOTTOM_SHEET_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const closeModal = () => {
        hideModal();
        setTimeout(() => {
            onClose();
        }, 250);
    };

    if (!asset) return null;

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    };

    const formatFileSize = (bytes) => {
        if (bytes == null) return 'Unknown';
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    };

    const parts = asset.uri.split('/');

    // Find the index of "0" and get everything after it for the path
    const zeroIndex = parts.indexOf('0');
    const pathAfterZero = zeroIndex !== -1 && zeroIndex < parts.length - 2
        ? parts.slice(zeroIndex + 1, -1).join('/')
        : '';

    // Get the immediate parent folder name
    const folderName = parts[parts.length - 2] || '';

    // Get filename without extension and file extension
    const filenameWithoutExt = asset.filename ? asset.filename.replace(/\.[^/.]+$/, '') : '';
    const fileExtension = asset.filename ? asset.filename.split('.').pop()?.toUpperCase() : '';

    const metadataItems = [
        {
            label: 'Name',
            value: filenameWithoutExt,
            icon: 'document-text-outline'
        },
        {
            label: 'Folder',
            value: folderName,
            icon: 'folder-outline'
        },
        {
            label: 'Type',
            value: fileExtension || (asset.mediaType === MediaLibrary.MediaType.video ? 'Video' : 'Photo'),
            icon: asset.mediaType === MediaLibrary.MediaType.video ? 'videocam-outline' : 'image-outline'
        },
        {
            label: 'Type',
            value: asset.mediaType === MediaLibrary.MediaType.video ? 'Video' : 'Photo',
            icon: asset.mediaType === MediaLibrary.MediaType.video ? 'videocam-outline' : 'image-outline'
        },
        {
            label: 'Size',
            value: formatFileSize(fileSize),
            icon: 'analytics-outline'
        },
        {
            label: 'Dimensions',
            value: `${asset.width} × ${asset.height}`,
            icon: 'resize-outline'
        },
        {
            label: 'Created',
            value: formatDate(asset.creationTime),
            icon: 'time-outline'
        }
    ];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={closeModal}
        >

            {/* Backdrop */}
            <Animated.View
                style={[styles.backdrop, { opacity: backdropOpacity }]}
            >
                <TouchableOpacity
                    style={StyleSheet.absoluteFillObject}
                    onPress={closeModal}
                    activeOpacity={1}
                />
            </Animated.View>

            {/* Bottom Sheet */}
            <Animated.View
                style={[
                    styles.bottomSheet,
                    {
                        transform: [{ translateY }]
                    }
                ]}
                {...panResponder.panHandlers}
            >
                {/* Handle */}
                <View style={styles.handleContainer}>
                    <View style={styles.handle} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerContent}>
                        <View style={styles.iconContainer}>
                            <Ionicons
                                name={asset.mediaType === MediaLibrary.MediaType.video ? 'videocam' : 'image'}
                                size={24}
                                color="#121212"
                            />
                        </View>
                        <View style={styles.headerText}>
                            <Text style={styles.title}>Media Details</Text>
                            <Text style={styles.subtitle}>
                                {asset.mediaType === MediaLibrary.MediaType.video ? 'Video File' : 'Photo File'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={closeModal}
                        style={styles.closeButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="close" size={24} color="#8E8E93" />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {metadataItems.map((item, index) => (
                        <View key={index} style={styles.metadataRow}>
                            <View style={styles.metadataLeft}>
                                <View style={styles.metadataIconContainer}>
                                    <Ionicons name={item.icon} size={20} color="#8E8E93" />
                                </View>
                                <Text style={styles.metadataLabel}>{item.label}</Text>
                            </View>
                            <Text style={styles.metadataValue} numberOfLines={2}>
                                {item.value}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Action Button */}
                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        style={styles.shareButton}
                        onPress={() => {
                            closeModal();
                            setTimeout(() => onShare(asset), 300);
                        }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="share-social" size={20} color="#121212" />
                        <Text style={styles.shareButtonText}>Share Media</Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: '#18181880',
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: BOTTOM_SHEET_HEIGHT,
        backgroundColor: '#121212', // Dark gray background
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderColor: '#55555555',
        borderWidth: 0.75,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 16,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 36,
        height: 4,
        backgroundColor: '#282828', // Mid-tone gray
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingBottom: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#55555555', // Lighter gray border
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#fff', // Lighter gray
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF', // White text
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 14,
        color: '#8E8E93', // Light gray text
        fontWeight: '400',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#181818', // Lighter gray
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    metadataRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#55555555', // Lighter gray border
    },
    metadataLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    metadataIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: '#181818', // Lighter gray
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    metadataLabel: {
        fontSize: 15,
        fontWeight: '500',
        color: '#FFFFFF', // White text
        flex: 1,
        maxWidth: '50%',
    },
    metadataValue: {
        fontSize: 15,
        color: '#8E8E93', // Light gray text
        textAlign: 'right',
        flex: 1,
        fontWeight: '400',
        maxWidth: '50%',
        height: 20
    },
    actionContainer: {
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 34 : 24,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#55555555', // Lighter gray border
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#efefef', // Mid-tone gray
        paddingVertical: 16,
        borderRadius: 12,
    },
    shareButtonText: {
        color: '#121212', // White text
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});