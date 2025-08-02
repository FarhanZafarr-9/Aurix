import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@DeletionHistory';

const HistoryContext = createContext();

export function HistoryProvider({ children }) {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const formattedSize = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
        return `${formattedSize} ${sizes[i]}`;
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInHours = Math.abs(now - date) / (1000 * 60 * 60);

        if (diffInHours < 1) {
            const minutes = Math.floor(diffInHours * 60);
            return `${minutes}m ago`;
        } else if (diffInHours < 24) {
            const hours = Math.floor(diffInHours);
            return `${hours}h ago`;
        } else if (diffInHours < 168) { // 7 days
            const days = Math.floor(diffInHours / 24);
            return `${days}d ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        }
    };

    // Save to AsyncStorage
    const persistHistory = async (updatedHistory) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
            console.log('History saved successfully');
        } catch (error) {
            console.error('Error saving history:', error);
        }
    };

    // Load on app start
    useEffect(() => {
        const loadHistory = async () => {
            try {
                setLoading(true);
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsedHistory = JSON.parse(saved);
                    console.log('Loaded history:', parsedHistory.length, 'entries');
                    setHistory(parsedHistory);
                } else {
                    console.log('No saved history found');
                }
            } catch (error) {
                console.error('Error loading history:', error);
            } finally {
                setLoading(false);
            }
        };

        loadHistory();
    }, []);

    const logDeletion = useCallback(({ itemCount, folderName, spaceFreed }) => {
        const timestamp = new Date().toISOString();
        const entry = {
            id: timestamp + '_' + Math.random().toString(36).substr(2, 9), // More unique ID
            folderName,
            itemCount,
            spaceFreed,
            timestamp,
            readableSize: formatSize(spaceFreed),
            timeFormatted: formatDate(timestamp),
        };

        console.log('Logging deletion:', entry);

        setHistory(prev => {
            const updated = [entry, ...prev];
            persistHistory(updated);
            return updated;
        });
    }, []);

    const clearHistory = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setHistory([]);
            console.log('History cleared');
        } catch (error) {
            console.error('Error clearing history:', error);
        }
    }, []);

    const getTotalStats = useCallback(() => {
        return history.reduce((stats, entry) => ({
            totalItems: stats.totalItems + entry.itemCount,
            totalSpace: stats.totalSpace + (entry.spaceFreed || 0),
            totalSessions: stats.totalSessions + 1
        }), { totalItems: 0, totalSpace: 0, totalSessions: 0 });
    }, [history]);

    const value = {
        history,
        loading,
        logDeletion,
        clearHistory,
        getTotalStats,
        formatSize,
        formatDate
    };

    return (
        <HistoryContext.Provider value={value}>
            {children}
        </HistoryContext.Provider>
    );
}

export function useHistory() {
    const context = useContext(HistoryContext);
    if (!context) {
        throw new Error('useHistory must be used within a HistoryProvider');
    }
    return context;
}