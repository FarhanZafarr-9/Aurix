import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const STORAGE_KEY = 'deletionHistory';
const HistoryContext = createContext();

export function HistoryProvider({ children }) {
    const [history, setHistory] = useState([]);

    const formatSize = (bytes) => {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    };

    // Save to AsyncStorage
    const persistHistory = async (updatedHistory) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
        } catch (e) {
            console.error('Error saving history:', e);
        }
    };

    // Load on app start
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY);
                if (saved) {
                    setHistory(JSON.parse(saved));
                }
            } catch (e) {
                console.error('Error loading history:', e);
            }
        };
        loadHistory();
    }, []);

    const logDeletion = useCallback(({ itemCount, folderName, spaceFreed }) => {
        const timestamp = new Date().toISOString();
        const entry = {
            id: timestamp,
            folderName,
            itemCount,
            spaceFreed,
            readableSize: formatSize(spaceFreed),
            timeFormatted: format(new Date(timestamp), 'dd MMM yyyy, HH:mm'),
        };

        setHistory(prev => {
            const updated = [entry, ...prev];
            persistHistory(updated);
            return updated;
        });
    }, []);

    return (
        <HistoryContext.Provider value={{ history, logDeletion }}>
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
