import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMedia } from '../contexts/MediaContext';
import { useTheme } from '../contexts/ThemeContext';
import BottomSheet from './BottomSheet';

const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatCount = (count) => {
    if (count < 10000) return count.toString();
    return `${Math.floor(count / 1000)}K+`;
};

const FolderItem = ({ folder, onPress, showCounts, showProgress }) => {
    const { colors, compactView } = useTheme();
    const {
        isFolderCompleted,
        getFolderCompletionInfo,
        hasActiveSession,
        clearFolderCompletion
    } = useMedia();

    const isCompleted = isFolderCompleted(folder.id);
    const completionInfo = getFolderCompletionInfo(folder.id);
    const hasSession = hasActiveSession(folder.id);
    const [isBottomSheetVisible, setBottomSheetVisible] = useState(false);

    const styles = useMemo(() => getStyles(colors, compactView, isCompleted), [colors, compactView, isCompleted]);

    const handlePress = () => {
        if (isCompleted) {
            setBottomSheetVisible(true);
        } else {
            onPress();
        }
    };

    const getStatusDisplay = () => {
        if (isCompleted) {
            if (completionInfo && completionInfo.itemsDeleted > 0) {
                return {
                    text: `${completionInfo.itemsDeleted} deleted`,
                    style: styles.completedText
                };
            } else {
                return {
                    text: 'Cleaned',
                    style: styles.completedText
                };
            }
        }

        if (hasSession) {
            return {
                text: 'In progress',
                style: styles.inProgressText
            };
        }

        return {
            text: 'Ready to clean',
            style: styles.readyText
        };
    };

    const statusDisplay = getStatusDisplay();

    const renderCompact = () => (
        <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.thumbnailContainer}>
                {folder.firstAssetUri ? (
                    <Image source={{ uri: folder.firstAssetUri }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
                        <Ionicons name="image-outline" size={20} color={colors.textSecondary} />
                    </View>
                )}
                {isCompleted && (
                    <View style={styles.completedOverlay}>
                        <Ionicons name="checkmark-circle" size={24} color="white" />
                    </View>
                )}
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.name} numberOfLines={1}>{folder.name}</Text>
                {showProgress && (
                    <View style={styles.detailsRow}>
                        <Text style={styles.itemCount}>{folder.totalCount} items</Text>
                        {folder.totalSize > 0 && !folder.isSkipped && (
                            <>
                                <Text style={styles.separator}>•</Text>
                                <Text style={styles.itemCount}>{formatBytes(folder.totalSize)}</Text>
                            </>
                        )}
                        <Text style={styles.separator}>•</Text>
                        <Text style={[styles.statusText, statusDisplay ? statusDisplay.style : {}]}>
                            {statusDisplay ? statusDisplay.text : ''}
                        </Text>
                    </View>
                )}
                {folder.isSkipped && (
                    <Text style={[styles.itemCount, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                        Folder size calculation skipped.
                    </Text>
                )}
            </View>

            <View style={styles.rightContainer}>
                {showCounts && (
                    <View style={styles.pillsContainer}>
                        {folder.videoCount > 0 && (
                            <View style={styles.pill}>
                                <Ionicons name="videocam" size={12} color={colors.text} />
                                <Text style={styles.pillText}>{formatCount(folder.videoCount)}</Text>
                            </View>
                        )}
                        {folder.photoCount > 0 && (
                            <View style={styles.pill}>
                                <Ionicons name="image" size={12} color={colors.text} />
                                <Text style={styles.pillText}>{formatCount(folder.photoCount)}</Text>
                            </View>
                        )}
                    </View>
                )}
                <Ionicons
                    name={isCompleted ? "checkmark-circle" : "chevron-forward"}
                    size={20}
                    color={isCompleted ? "#4CAF50" : colors.textSecondary}
                />
            </View>
        </TouchableOpacity>
    );

    const renderDefault = () => (
        <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
            <View style={styles.thumbnailContainer}>
                {folder.firstAssetUri ? (
                    <Image source={{ uri: folder.firstAssetUri }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                    <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
                        <Ionicons name="image-outline" size={32} color={colors.textSecondary} />
                    </View>
                )}
                {isCompleted && (
                    <View style={styles.completedOverlay}>
                        <Ionicons name="checkmark-circle" size={32} color="white" />
                    </View>
                )}
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.name} numberOfLines={2}>{folder.name}</Text>
                {showProgress && (
                    <Text style={[styles.statusText, statusDisplay ? statusDisplay.style : {}]}>
                        {statusDisplay ? statusDisplay.text : ''}
                    </Text>
                )}
            </View>

            <View style={styles.rightContainer}>
                {showCounts && (
                    <>
                        <View style={styles.countItem}>
                            <Ionicons name="image-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.countText}>{formatCount(folder.photoCount)} photos</Text>
                        </View>
                        <View style={styles.countItem}>
                            <Ionicons name="videocam-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.countText}>{formatCount(folder.videoCount)} videos</Text>
                        </View>
                        <View style={styles.countItem}>
                            <Ionicons name="analytics-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.countText}>{formatBytes(folder.totalSize)} total</Text>
                        </View>
                    </>
                )}
                {folder.isSkipped && (
                    <Text style={[styles.itemCount, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                        Size calculation skipped
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <>
            {compactView ? renderCompact() : renderDefault()}
            {completionInfo && (
                <BottomSheet
                    visible={isBottomSheetVisible}
                    title="Folder Already Completed"
                    pillText={new Date(completionInfo.completedAt).toLocaleDateString()}
                    message={`Results: ${completionInfo.itemsDeleted} items deleted, rest items kept.\n\nWhat would you like to do?`}
                    buttons={['Cancel', 'Re-evaluate', 'View Results']}
                    actions={[
                        () => setBottomSheetVisible(false),
                        () => {
                            clearFolderCompletion(folder.id);
                            onPress();
                            setBottomSheetVisible(false);
                        },
                        () => {
                            onPress();
                            setBottomSheetVisible(false);
                        },
                    ]}
                    destructiveIndex={1}
                    successiveIndex={2}
                    onClose={() => setBottomSheetVisible(false)}
                />
            )}
        </>
    );
};

const getStyles = (colors, compactView, isCompleted) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: compactView ? 12 : 16,
        backgroundColor: isCompleted ? colors.background : colors.card,
        borderRadius: 12,
        marginBottom: compactView ? 8 : 12,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: !isCompleted ? 1 : 0.6,
    },
    thumbnailContainer: {
        position: 'relative',
        marginRight: compactView ? 12 : 16,
    },
    thumbnail: {
        width: compactView ? 50 : 64,
        height: compactView ? 50 : 64,
        borderRadius: 8,
        backgroundColor: colors.surface,
    },
    placeholderThumbnail: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    completedOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
        gap: compactView ? 4 : 6,
    },
    name: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
        height: compactView ? 24 : 'auto',
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    itemCount: {
        color: colors.textSecondary,
        fontSize: 12,
        height: 16,
        fontWeight: '500',
    },
    separator: {
        color: colors.textTertiary,
        fontSize: 13,
        marginHorizontal: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        height: 16,
    },
    rightContainer: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginLeft: 8,
        gap: compactView ? 4 : 6,
    },
    pillsContainer: {
        flexDirection: 'row',
        gap: 4,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: colors.surface,
    },
    pillText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    countItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: 120,
        justifyContent: 'flex-start',
    },
    countText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
});

export default FolderItem;