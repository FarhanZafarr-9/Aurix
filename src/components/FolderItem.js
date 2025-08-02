import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMedia } from '../contexts/MediaContext';

const FolderItem = ({ folder, onPress }) => {
    const { getFolderCompletionStats } = useMedia();
    const completionStats = getFolderCompletionStats(folder.id);

    const getStatusInfo = () => {
        if (!completionStats) return null;

        switch (completionStats.status) {
            case 'completed':
                return {
                    color: '#4CAF50',
                    text: completionStats.itemsToDelete > 0
                        ? `${completionStats.itemsToDelete} to delete`
                        : 'Completed',
                    showCheckmark: true
                };
            case 'in-progress':
                return {
                    color: '#FF9500',
                    text: `${completionStats.currentIndex}/${completionStats.totalCount}`,
                    progress: (completionStats.currentIndex / completionStats.totalCount) * 100
                };
            case 'initialized':
                return {
                    color: '#007AFF',
                    text: 'Ready to start'
                };
            default:
                return null;
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.9}>
            {/* Thumbnail with status overlay */}
            <View style={styles.thumbnailContainer}>
                {folder.firstAssetUri ? (
                    <Image
                        source={{ uri: folder.firstAssetUri }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
                        <Ionicons name="image-outline" size={20} color="#666" />
                    </View>
                )}

                {statusInfo?.showCheckmark && (
                    <View style={styles.checkmarkOverlay}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                    </View>
                )}
            </View>

            {/* Folder Info */}
            <View style={styles.infoContainer}>
                <Text style={styles.name} numberOfLines={1}>{folder.name}</Text>

                <View style={styles.detailsRow}>
                    <Text style={styles.itemCount}>{folder.totalCount} items</Text>

                    {statusInfo && (
                        <>
                            <Text style={styles.separator}>•</Text>
                            <Text style={[styles.statusText, { color: statusInfo.color }]}>
                                {statusInfo.text}
                            </Text>
                        </>
                    )}
                </View>

                {/* Progress bar for in-progress folders */}
                {statusInfo?.progress && (
                    <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${statusInfo.progress}%` }]} />
                    </View>
                )}
            </View>

            {/* Media type pills and arrow */}
            <View style={styles.rightContainer}>
                <View style={styles.pillsContainer}>
                    {folder.videoCount > 0 && (
                        <View style={styles.pill}>
                            <Ionicons name="videocam" size={12} color="#fff" />
                            <Text style={styles.pillText}>{folder.videoCount}</Text>
                        </View>
                    )}
                    {folder.photoCount > 0 && (
                        <View style={styles.pill}>
                            <Ionicons name="image" size={12} color="#fff" />
                            <Text style={styles.pillText}>{folder.photoCount}</Text>
                        </View>
                    )}
                </View>
                <Ionicons name="chevron-forward" size={20} color="#888" />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        marginBottom: 8,
    },
    thumbnailContainer: {
        position: 'relative',
        marginRight: 12,
    },
    thumbnail: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: '#2a2a2a',
    },
    placeholderThumbnail: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmarkOverlay: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#1a1a1a',
        borderRadius: 10,
        padding: 2,
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
        gap: 4,
    },
    name: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        
    },
    itemCount: {
        color: '#888',
        fontSize: 12,
        height: 16,
        fontWeight: '600',
        letterSpacing: 0.6
    },
    separator: {
        color: '#666',
        fontSize: 13,
        marginHorizontal: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.8,
        height: 16
    },
    progressBar: {
        height: 2,
        backgroundColor: '#333',
        borderRadius: 1,
        marginTop: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#FF9500',
        borderRadius: 1,
    },
    rightContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginLeft: 8,
        gap: 4,
    },
    pillsContainer: {
        flexDirection: 'row',
        gap: 4,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: '#ffffff14',
        borderColor: '#55555555',
        borderWidth: 0.75,
    },
    pillText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
        height: 16,
    },
});

export default FolderItem;