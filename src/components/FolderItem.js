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

const FolderItem = ({ folder, onPress, showCounts, showProgress }) => {
    const { colors } = useTheme();
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

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            backgroundColor: isCompleted ? colors.background : colors.card,
            borderRadius: 10,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: '#44444444',
            opacity: !isCompleted ? 1 : 0.5
        },
        thumbnailContainer: {
            position: 'relative',
            marginRight: 12,
        },
        thumbnail: {
            width: 50,
            height: 50,
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
            backgroundColor: colors.surface + 'b0',
            overflow: 'hidden',
            borderRadius: 6,
            justifyContent: 'center',
            alignItems: 'center',
        },
        infoContainer: {
            flex: 1,
            justifyContent: 'center',
            gap: 4,
        },
        name: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '500',
            height: 24
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
            fontWeight: '600',
            letterSpacing: 0.6
        },
        separator: {
            color: colors.textTertiary,
            fontSize: 13,
            marginHorizontal: 6,
        },
        statusText: {
            fontSize: 12,
            fontWeight: '600',
            letterSpacing: 0.8,
            height: 16
        },
        completedText: {
            color: '#4CAF50',
        },
        inProgressText: {
            color: '#FF9500',
        },
        readyText: {
            color: '#007AFF',
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
            backgroundColor: colors.highlight,
            borderColor: colors.border,
            borderWidth: 0.75,
        },
        pillText: {
            color: colors.text,
            fontSize: 12,
            fontWeight: '600',
            marginLeft: 4,
            height: 16,
        },
    }), [colors, isCompleted]);

    const handlePress = () => {
        if (isCompleted) {
            setBottomSheetVisible(true);
        } else {
            onPress();
        }
    };

    const getStatusDisplay = () => {
        if (isCompleted) {
            if (completionInfo?.itemsDeleted > 0) {
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

        return null;
        return {
            text: 'Ready to clean',
            style: styles.readyText
        };
    };

    const statusDisplay = getStatusDisplay();

    return (
        <>
            <TouchableOpacity
                style={styles.container}
                onPress={handlePress}
                activeOpacity={0.7}
            >
                {/* Thumbnail with completion overlay */}
                <View style={styles.thumbnailContainer}>
                    {folder.firstAssetUri ? (
                        <Image
                            source={{ uri: folder.firstAssetUri }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                        />
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

                {/* Folder Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.name} numberOfLines={1}>{folder.name}</Text>

                    {showProgress && <View style={styles.detailsRow}>
                        <Text style={styles.itemCount}>{folder.totalCount} items</Text>
                        {folder.totalSize > 0 && (
                            <>
                                <Text style={styles.separator}>•</Text>
                                <Text style={styles.itemCount}>{formatBytes(folder.totalSize)}</Text>
                            </>
                        )}
                        {statusDisplay &&
                            <>
                                <Text style={styles.separator}>•</Text>
                                <Text style={[styles.statusText, statusDisplay.style]}>
                                    {statusDisplay.text}
                                </Text>
                            </>}
                    </View>}
                </View>

                {/* Media type pills and indicator */}
                <View style={styles.rightContainer}>
                    {showCounts && <View style={styles.pillsContainer}>
                        {folder.videoCount > 0 && (
                            <View style={styles.pill}>
                                <Ionicons name="videocam" size={12} color={colors.text} />
                                <Text style={styles.pillText}>{folder.videoCount}</Text>
                            </View>
                        )}
                        {folder.photoCount > 0 && (
                            <View style={styles.pill}>
                                <Ionicons name="image" size={12} color={colors.text} />
                                <Text style={styles.pillText}>{folder.photoCount}</Text>
                            </View>
                        )}
                    </View>}

                    <Ionicons
                        name={isCompleted ? "checkmark-circle" : "chevron-forward"}
                        size={20}
                        color={isCompleted ? "#4CAF50" : colors.textSecondary}
                    />
                </View>
            </TouchableOpacity>

            {completionInfo && (
                <BottomSheet
                    visible={isBottomSheetVisible}
                    title="Folder Already Completed"
                    pillText={new Date(completionInfo.completedAt).toLocaleDateString()}
                    message={`Results: ${completionInfo.itemsDeleted} items deleted, rest items kept.\n\nWhat would you like to do?`}
                    buttons={['Cancel', 'Re-evaluate', 'View Results']}
                    actions={[
                        () => setBottomSheetVisible(false), // Cancel
                        () => {
                            clearFolderCompletion(folder.id);
                            onPress();
                            setBottomSheetVisible(false);
                        }, // Re-evaluate
                        () => {
                            onPress();
                            setBottomSheetVisible(false);
                        } // View Results
                    ]}
                    destructiveIndex={1}
                    successiveIndex={2}
                    onClose={() => setBottomSheetVisible(false)}
                />
            )}
        </>
    );
};

export default FolderItem;