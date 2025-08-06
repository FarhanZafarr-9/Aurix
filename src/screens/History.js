import React, { useEffect, useRef, useMemo } from 'react';
import {
    View, Text, FlatList, StyleSheet, Animated, TouchableOpacity, Alert, ActivityIndicator, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHistory } from '../contexts/HistoryContext';
import { useTheme } from '../contexts/ThemeContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LineChart } from 'react-native-chart-kit';

// Extend dayjs with relative time plugin
dayjs.extend(relativeTime);

export default function History() {
    const { colors, isDarkMode } = useTheme();
    const { history, loading, clearHistory, getTotalStats, formatSize } = useHistory();
    const fadeAnim = useRef(new Map()).current;

    const totalStats = getTotalStats();

    // Extract RGB values from the text color
    const textColorRgb = useMemo(() => {
        // Default to white if parsing fails
        if (!colors.text || !colors.text.startsWith('rgba')) return isDarkMode?'255, 255, 255':'0, 0, 0';
        const matches = colors.text.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
        return matches ? `${matches[1]}, ${matches[2]}, ${matches[3]}` : '255, 255, 255';
    }, [colors.text]);

    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
            paddingBottom: 55
        },
        centerContent: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24
        },
        header: {
            paddingHorizontal: 20,
            paddingTop: 36,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.header,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border
        },
        headerTitle: {
            color: colors.text,
            fontSize: 20,
            fontWeight: '600',
            height: 30
        },
        headerSubtitle: {
            color: colors.textSecondary,
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
            backgroundColor: colors.card,
            paddingVertical: 6,
            paddingHorizontal: 12,
            marginTop: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 6
        },
        summaryText: {
            color: '#4CAF50',
            fontSize: 13,
            fontWeight: '500',
        },
        chartContainer: {
            marginVertical: 16,
            paddingHorizontal: 12,
        },
        chartTitle: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 8,
            paddingHorizontal: 8,
        },
        listContent: {
            paddingHorizontal: 12,
            paddingBottom: 16,
            paddingTop: 8,
            minHeight: '100%'
        },
        card: {
            backgroundColor: colors.card,
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
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
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
        },
        titleText: {
            color: colors.text,
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
            backgroundColor: colors.border,
            marginVertical: 12,
        },
        metaBlock: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 6,
            width: '100%'
        },
        metaColumn: {
            flex: 1,
        },
        label: {
            color: colors.textTertiary,
            fontSize: 11,
            marginBottom: 4,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        value: {
            color: colors.textSecondary,
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
            color: colors.textSecondary,
            fontSize: 16,
            marginTop: 16,
            textAlign: 'center',
            height: 22
        },
        emptySubtext: {
            color: colors.textTertiary,
            fontSize: 12,
            marginTop: 8,
            textAlign: 'center',
            lineHeight: 18,
        },
        loadingText: {
            color: colors.textSecondary,
            marginTop: 12,
            fontSize: 14,
        },
    }), [colors]);

    // Initialize and animate fade in effect for each card
    useEffect(() => {
        fadeAnim.clear();

        history.forEach((item, index) => {
            const animValue = new Animated.Value(0);
            fadeAnim.set(item.id, animValue);

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

    // Prepare chart data with item count instead of size
    const chartData = useMemo(() => {
        if (history.length === 0) return null;

        // Sort history by date (newest first)
        const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Take the last 7 entries for the chart
        const recentHistory = sortedHistory.slice(0, 7).reverse();

        return {
            labels: recentHistory.map(item => dayjs(item.timestamp).format('MMM D')),
            datasets: [
                {
                    data: recentHistory.map(item => item.itemCount), // Using item count instead of size
                    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`, // Green color
                    strokeWidth: 2
                }
            ],
        };
    }, [history]);

    const renderItem = ({ item, index }) => {
        const animValue = fadeAnim.get(item.id) || new Animated.Value(1);

        const animatedStyle = {
            opacity: animValue,
            transform: [{
                translateY: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                })
            }]
        };

        return (
            <Animated.View style={[styles.card, animatedStyle]}>
                <View style={styles.topRow}>
                    <View style={styles.leftSide}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
                        </View>
                        <Text style={styles.titleText}>
                            {item.itemCount} item{item.itemCount !== 1 ? 's' : ''} deleted
                        </Text>
                    </View>
                    <Text style={styles.sizeText}>{item.readableSize}</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.metaBlock}>
                    <View style={styles.metaColumn}>
                        <Text style={styles.label}>Folder</Text>
                        <Text style={styles.value} numberOfLines={1}>{item.folderName}</Text>
                    </View>
                    <View style={styles.metaColumn}>
                        <Text style={styles.label}>When</Text>
                        <Text style={styles.value}>
                            {dayjs(item.timestamp).fromNow()}
                        </Text>
                    </View>
                </View>
            </Animated.View>
        );
    };

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
                    <ActivityIndicator size="large" color={colors.textSecondary} />
                    <Text style={styles.loadingText}>Loading history...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
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

            {/* Chart Section */}
            {chartData && history.length > 1 && (
                <View style={styles.chartContainer}>
                    <Text style={styles.chartTitle}>Recent Items Deleted</Text>
                    <LineChart
                        data={chartData}
                        width={Dimensions.get('window').width - 24}
                        height={220}
                        yAxisLabel=""
                        yAxisSuffix=" items"
                        fromZero
                        chartConfig={{
                            backgroundColor: colors.card,
                            backgroundGradientFrom: colors.card,
                            backgroundGradientTo: colors.card,
                            decimalPlaces: 0, // No decimals for item count
                            color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(${textColorRgb}, ${opacity})`,
                            style: {
                                borderRadius: 16,
                                fontWeight: '600'
                            },
                            propsForDots: {
                                r: "4",
                                strokeWidth: "2",
                                stroke: "#4CAF50"
                            },
                            propsForLabels: {
                                fontSize: 10
                            }
                        }}
                        bezier
                        style={{
                            marginVertical: 8,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                    />
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
                            <Ionicons name="time-outline" size={48} color={colors.textSecondary} />
                            <Text style={styles.emptyText}>No cleanup history yet</Text>
                            <Text style={styles.emptySubtext}>
                                Complete a folder cleanup to see your deletion history here
                            </Text>
                        </View>
                    }
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                />
            </View>
        </View>
    );
}