import React, { useEffect, useRef } from 'react';
import {
    View, Text, FlatList, StyleSheet, Animated, TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHistory } from '../contexts/HistoryContext';

export default function History() {
    const { history, loading, clearHistory, getTotalStats, formatSize } = useHistory();
    const fadeAnim = useRef(new Map()).current;

    const totalStats = getTotalStats();

    // Initialize and animate fade in effect for each card
    useEffect(() => {
        // Clear any existing animations
        fadeAnim.clear();

        history.forEach((item, index) => {
            const animValue = new Animated.Value(0);
            fadeAnim.set(item.id, animValue);

            // Start animation with a delay based on index
            Animated.timing(animValue, {
                toValue: 1,
                duration: 300,
                delay: index * 50,
                useNativeDriver: true,
            }).start();
        });
    }, [history]);

    const handleClearHistory = () => {
        Alert.alert(
            'Clear History',
            'This will permanently delete all cleanup history. This action cannot be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel'
                },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: clearHistory
                }
            ]
        );
    };

    const renderItem = ({ item, index }) => {
        // Get animation value, fallback to 1 if not found
        const animValue = fadeAnim.get(item.id);

        // Debug log to check if item is being rendered
        console.log('Rendering item:', item.id, 'with animValue:', animValue);

        const animatedStyle = animValue ? {
            opacity: animValue,
            transform: [{
                translateY: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                })
            }]
        } : {
            // Fallback style if animation fails
            opacity: 1,
            transform: [{ translateY: 0 }]
        };

        return (
            <Animated.View style={[styles.card, animatedStyle]}>
                {/* Top Row */}
                <View style={styles.topRow}>
                    <View style={styles.leftSide}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="trash-outline" size={16} color="#888" />
                        </View>
                        <Text style={styles.titleText}>
                            {item.itemCount} item{item.itemCount !== 1 ? 's' : ''} deleted
                        </Text>
                    </View>
                    <Text style={styles.sizeText}>{item.readableSize}</Text>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Metadata */}
                <View style={styles.metaBlock}>
                    <View style={styles.metaColumn}>
                        <Text style={styles.label}>Folder</Text>
                        <Text style={styles.value} numberOfLines={1}>{item.folderName}</Text>
                    </View>
                    <View style={styles.metaColumn}>
                        <Text style={styles.label}>When</Text>
                        <Text style={styles.value}>{item.timeFormatted}</Text>
                    </View>
                </View>
            </Animated.View>
        );
    };

    // Debug log to check history data
    /*
    console.log('History data:', history);
    console.log('History length:', history.length);
    console.log('Loading state:', loading);
    */

    if (loading) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Cleanup History</Text>
                        <Text style={styles.headerSubtitle}>Loading...</Text>
                    </View>
                </View>
                <View style={styles.centerContent}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.loadingText}>Loading history...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header matching Folders screen */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Cleanup History</Text>
                    <Text style={styles.headerSubtitle}>
                        {history.length} session{history.length !== 1 ? 's' : ''}
                        {totalStats.totalItems > 0 && ` • ${totalStats.totalItems} items deleted`}
                        {totalStats.totalSpace > 0 && ` • ${formatSize(totalStats.totalSpace)} freed`}
                    </Text>
                </View>

                {history.length > 0 && (
                    <TouchableOpacity
                        onPress={handleClearHistory}
                        style={styles.clearButton}
                    >
                        <Ionicons name="trash-outline" size={18} color="#ff5555" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Summary stats */}
            {totalStats.totalSpace > 0 && (
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryPill}>
                        <Ionicons name="save-outline" size={14} color="#4CAF50" />
                        <Text style={styles.summaryText}>
                            Total Saved: {formatSize(totalStats.totalSpace)}
                        </Text>
                    </View>
                </View>
            )}

            <View style={{ flex: 1 }}>
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={renderItem}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="time-outline" size={48} color="#666" />
                            <Text style={styles.emptyText}>No cleanup history yet</Text>
                            <Text style={styles.emptySubtext}>
                                Complete a folder cleanup to see your deletion history here
                            </Text>
                        </View>
                    }
                    showsVerticalScrollIndicator={false}
                    // Performance optimizations
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    removeClippedSubviews={false} // Changed to false for debugging
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        paddingBottom: 55
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24
    },
    // Header styles matching Folders screen
    header: {
        paddingHorizontal: 20,
        paddingTop: 36,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#181818',
        borderBottomWidth: 0.5,
        borderBottomColor: '#333'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
        height: 30
    },
    headerSubtitle: {
        color: '#666',
        fontSize: 12,
        marginTop: 4
    },
    clearButton: {
        padding: 6,
        marginLeft: 10
    },
    summaryContainer: {
        paddingHorizontal: 14,
        paddingBottom: 10,
        alignItems: 'flex-start'
    },
    summaryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginTop: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        gap: 6
    },
    summaryText: {
        color: '#4CAF50',
        fontSize: 13,
        fontWeight: '500',
    },
    debugContainer: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        backgroundColor: '#222'
    },
    debugText: {
        color: '#ff0',
        fontSize: 12
    },
    listContent: {
        paddingHorizontal: 12,
        paddingBottom: 16,
        paddingTop: 8,
        minHeight: '100%'
    },
    card: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#2a2a2a',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftSide: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#2a2a2a',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    titleText: {
        color: '#eee',
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    sizeText: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#2f2f2f',
        marginVertical: 12,
    },
    metaBlock: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
    },
    metaColumn: {
        flex: 1,
    },
    label: {
        color: '#777',
        fontSize: 11,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    value: {
        color: '#ccc',
        fontSize: 14,
        fontWeight: '500',
        height: 18
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        paddingTop: 100,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        marginTop: 16,
        textAlign: 'center',
        height: 22
    },
    emptySubtext: {
        color: '#555',
        fontSize: 12,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 18,
    },
    loadingText: {
        color: '#888',
        marginTop: 12,
        fontSize: 14,
    },
});