import React, { useEffect, useRef } from 'react';
import {
    View, Text, FlatList, StyleSheet, Dimensions, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHistory } from '../contexts/HistoryContext';

const { width } = Dimensions.get('window');

// Helper to calculate total saved
function calculateTotalSaved(history) {
    const totalBytes = history.reduce((sum, h) => sum + (h.spaceFreed || 0), 0);
    const mb = totalBytes / (1024 * 1024);
    if (mb > 1024) return (mb / 1024).toFixed(2) + ' GB';
    return mb.toFixed(1) + ' MB';
}

export default function History() {
    const { history } = useHistory();
    const fadeAnim = useRef([]); // one ref per item

    // Fade in effect for each card
    useEffect(() => {
        history.forEach((_, i) => {
            if (!fadeAnim.current[i]) {
                fadeAnim.current[i] = new Animated.Value(0);
            }

            Animated.timing(fadeAnim.current[i], {
                toValue: 1,
                duration: 300,
                delay: i * 60,
                useNativeDriver: true,
            }).start();
        });
    }, [history]);

    const renderItem = ({ item, index }) => (
        <Animated.View style={[styles.card, { opacity: fadeAnim.current[index] || 0 }]}>
            {/* Top Row */}
            <View style={styles.topRow}>
                <View style={styles.leftSide}>
                    <Ionicons name="trash-outline" size={18} color="#888" style={styles.icon} />
                    <Text style={styles.titleText}>
                        {item.itemCount} item{item.itemCount > 1 ? 's' : ''} deleted
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
                    <Text style={styles.value}>{item.folderName}</Text>
                </View>
                <View style={styles.metaColumn}>
                    <Text style={styles.label}>Date</Text>
                    <Text style={styles.value}>{item.timeFormatted}</Text>
                </View>
            </View>
        </Animated.View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Cleanup History</Text>

            {history.length > 0 && (
                <View style={styles.pill}>
                    <Text style={styles.pillText}>
                        Total Saved: {calculateTotalSaved(history)}
                    </Text>
                </View>
            )}

            <FlatList
                data={history}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                renderItem={renderItem}
                ListEmptyComponent={<Text style={styles.emptyText}>No history yet</Text>}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        paddingTop: 40,
    },
    header: {
        fontSize: 22,
        color: '#fff',
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 8,
        height: 30
    },
    pill: {
        alignSelf: 'center',
        backgroundColor: '#1e1e1e',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        marginBottom: 10,
    },
    pillText: {
        color: '#aaa',
        fontSize: 13,
        fontWeight: '500',
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    card: {
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        marginBottom: 14,
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
    },
    icon: {
        marginRight: 6,
    },
    titleText: {
        color: '#eee',
        fontSize: 15,
        fontWeight: '600',
    },
    sizeText: {
        color: '#aaa',
        fontSize: 14,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#2f2f2f',
        marginVertical: 10,
    },
    metaBlock: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metaColumn: {
        flexDirection: 'column',
    },
    label: {
        color: '#777',
        fontSize: 12,
        marginBottom: 2,
    },
    value: {
        color: '#ccc',
        fontSize: 14,
        fontWeight: '500',
        height: 20
    },
    emptyText: {
        color: '#555',
        fontSize: 15,
        textAlign: 'center',
        marginTop: 60,
        height: 20
    },
});
