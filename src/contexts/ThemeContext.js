import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    THEME_SETTINGS: '@ThemeSettings',
    APPEARANCE_SETTINGS: '@AppearanceSettings',
    ORGANIZATION_SETTINGS: '@OrganizationSettings',
    CLEANUP_SETTINGS: '@CleanupSettings'
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    // Theme state
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [showMediaCounts, setShowMediaCounts] = useState(true);
    const [hideCompleted, setHideCompleted] = useState(false);
    const [compactView, setCompactView] = useState(false);

    // Organization settings
    const [sortMethod, setSortMethod] = useState('count');
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [showProgress, setShowProgress] = useState(true);
    const [excludedFolders, setExcludedFolders] = useState([]);

    // Cleanup settings
    const [confirmBeforeDelete, setConfirmBeforeDelete] = useState(true);
    const [saveDeletedHistory, setSaveDeletedHistory] = useState(true);
    const [autoBackup, setAutoBackup] = useState(true);
    const [batchSize, setBatchSize] = useState('medium');

    // Load settings from AsyncStorage on mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const [themeSettings, appearanceSettings, organizationSettings, cleanupSettings] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.THEME_SETTINGS),
                    AsyncStorage.getItem(STORAGE_KEYS.APPEARANCE_SETTINGS),
                    AsyncStorage.getItem(STORAGE_KEYS.ORGANIZATION_SETTINGS),
                    AsyncStorage.getItem(STORAGE_KEYS.CLEANUP_SETTINGS)
                ]);

                // Load theme settings
                if (themeSettings) {
                    const theme = JSON.parse(themeSettings);
                    setIsDarkMode(theme.isDarkMode ?? true);
                }

                // Load appearance settings
                if (appearanceSettings) {
                    const appearance = JSON.parse(appearanceSettings);
                    setShowMediaCounts(appearance.showMediaCounts ?? true);
                    setHideCompleted(appearance.hideCompleted ?? false);
                    setCompactView(appearance.compactView ?? false);
                }

                // Load organization settings
                if (organizationSettings) {
                    const organization = JSON.parse(organizationSettings);
                    setSortMethod(organization.sortMethod ?? 'count');
                    setAutoRefresh(organization.autoRefresh ?? false);
                    setShowProgress(organization.showProgress ?? true);
                    setExcludedFolders(organization.excludedFolders ?? []);
                }

                // Load cleanup settings
                if (cleanupSettings) {
                    const cleanup = JSON.parse(cleanupSettings);
                    setConfirmBeforeDelete(cleanup.confirmBeforeDelete ?? false);
                    setSaveDeletedHistory(cleanup.saveDeletedHistory ?? true);
                    setAutoBackup(cleanup.autoBackup ?? true);
                    setBatchSize(cleanup.batchSize ?? 'medium');
                }
            } catch (error) {
                console.warn('Failed to load theme settings:', error);
            }
        };

        loadSettings();
    }, []);

    // Save theme settings
    const saveThemeSettings = useCallback(async (settings) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.THEME_SETTINGS, JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save theme settings:', error);
        }
    }, []);

    // Save appearance settings
    const saveAppearanceSettings = useCallback(async (settings) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.APPEARANCE_SETTINGS, JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save appearance settings:', error);
        }
    }, []);

    // Save organization settings
    const saveOrganizationSettings = useCallback(async (settings) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.ORGANIZATION_SETTINGS, JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save organization settings:', error);
        }
    }, []);

    // Save cleanup settings
    const saveCleanupSettings = useCallback(async (settings) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEYS.CLEANUP_SETTINGS, JSON.stringify(settings));
        } catch (error) {
            console.error('Failed to save cleanup settings:', error);
        }
    }, []);

    // Theme toggle with persistence
    const toggleDarkMode = useCallback(async () => {
        const newValue = !isDarkMode;
        setIsDarkMode(newValue);
        await saveThemeSettings({ isDarkMode: newValue });
    }, [isDarkMode, saveThemeSettings]);

    // Appearance settings with persistence
    const updateShowMediaCounts = useCallback(async (value) => {
        setShowMediaCounts(value);
        await saveAppearanceSettings({ showMediaCounts: value, hideCompleted, compactView });
    }, [hideCompleted, compactView, saveAppearanceSettings]);

    const updateHideCompleted = useCallback(async (value) => {
        setHideCompleted(value);
        await saveAppearanceSettings({ showMediaCounts, hideCompleted: value, compactView });
    }, [showMediaCounts, compactView, saveAppearanceSettings]);

    const updateCompactView = useCallback(async (value) => {
        setCompactView(value);
        await saveAppearanceSettings({ showMediaCounts, hideCompleted, compactView: value });
    }, [showMediaCounts, hideCompleted, saveAppearanceSettings]);

    // Organization settings with persistence
    const updateSortMethod = useCallback(async (method) => {
        setSortMethod(method);
        await saveOrganizationSettings({ sortMethod: method, autoRefresh, showProgress, excludedFolders });
    }, [autoRefresh, showProgress, excludedFolders, saveOrganizationSettings]);

    const updateAutoRefresh = useCallback(async (value) => {
        setAutoRefresh(value);
        await saveOrganizationSettings({ sortMethod, autoRefresh: value, showProgress, excludedFolders });
    }, [sortMethod, showProgress, excludedFolders, saveOrganizationSettings]);

    const updateShowProgress = useCallback(async (value) => {
        setShowProgress(value);
        await saveOrganizationSettings({ sortMethod, autoRefresh, showProgress: value, excludedFolders });
    }, [sortMethod, autoRefresh, excludedFolders, saveOrganizationSettings]);

    const updateExcludedFolders = useCallback(async (folders) => {
        setExcludedFolders(folders);
        await saveOrganizationSettings({ sortMethod, autoRefresh, showProgress, excludedFolders: folders });
    }, [sortMethod, autoRefresh, showProgress, saveOrganizationSettings]);

    // Cleanup settings with persistence
    const updateConfirmBeforeDelete = useCallback(async (value) => {
        setConfirmBeforeDelete(value);
        await saveCleanupSettings({ confirmBeforeDelete: value, saveDeletedHistory, autoBackup, batchSize });
    }, [saveDeletedHistory, autoBackup, batchSize, saveCleanupSettings]);

    const updateSaveDeletedHistory = useCallback(async (value) => {
        setSaveDeletedHistory(value);
        await saveCleanupSettings({ confirmBeforeDelete, saveDeletedHistory: value, autoBackup, batchSize });
    }, [confirmBeforeDelete, autoBackup, batchSize, saveCleanupSettings]);

    const updateAutoBackup = useCallback(async (value) => {
        setAutoBackup(value);
        await saveCleanupSettings({ confirmBeforeDelete, saveDeletedHistory, autoBackup: value, batchSize });
    }, [confirmBeforeDelete, saveDeletedHistory, batchSize, saveCleanupSettings]);

    const updateBatchSize = useCallback(async (size) => {
        setBatchSize(size);
        await saveCleanupSettings({ confirmBeforeDelete, saveDeletedHistory, autoBackup, batchSize: size });
    }, [confirmBeforeDelete, saveDeletedHistory, autoBackup, saveCleanupSettings]);

    // Theme colors
    const colors = useMemo(() => {
        if (isDarkMode) {
            return {
                // Background colors
                background: '#121212',
                surface: '#1E1E1E',
                card: '#1A1A1A',
                header: '#1C1C1C',

                // Text colors
                text: '#F1F1F1',
                textSecondary: '#A0A0A0',
                textTertiary: '#777777',

                // Border colors
                border: '#2E2E2E',
                borderLight: '#3A3A3A',

                // Interactive colors
                primary: '#4CAF50',
                primaryLight: '#66BB6A',
                secondary: '#888888',
                accent: '#42A5F5',

                // Switch colors
                switchTrack: { false: '#333333', true: '#4CAF50' },
                switchThumb: '#F1F1F1',
                switchThumbInactive: '#888888',

                // Status colors
                success: '#4CAF50',
                warning: '#FFA726',
                error: '#EF5350',
                info: '#29B6F6',

                // Overlay colors
                overlay: 'rgba(0, 0, 0, 0.4)',
                modal: '#1E1E1E',

                // Animation colors
                shimmer: '#2A2A2A',
                shimmerHighlight: '#333333'
            };
        } else {
            return {
                // Background colors
                background: '#FAFAFA',
                surface: '#F2F2F2',
                card: '#FFFFFF',
                header: '#F7F7F7',

                // Text colors
                text: '#1A1A1A',
                textSecondary: '#5A5A5A',
                textTertiary: '#9E9E9E',

                // Border colors
                border: '#DDDDDD',
                borderLight: '#EAEAEA',

                // Interactive colors
                primary: '#4CAF50',
                primaryLight: '#81C784',
                secondary: '#888888',
                accent: '#42A5F5',

                // Switch colors
                switchTrack: { false: '#CCCCCC', true: '#4CAF50' },
                switchThumb: '#FFFFFF',
                switchThumbInactive: '#AAAAAA',

                // Status colors
                success: '#4CAF50',
                warning: '#FFB74D',
                error: '#E57373',
                info: '#29B6F6',

                // Overlay colors
                overlay: 'rgba(0, 0, 0, 0.15)',
                modal: '#FFFFFF',

                // Animation colors
                shimmer: '#EDEDED',
                shimmerHighlight: '#F5F5F5'
            };
        }
    }, [isDarkMode]);

    // Batch size mapping
    const batchSizeMap = useMemo(() => ({
        small: 5,
        medium: 10,
        large: 20,
        xlarge: 50
    }), []);

    const getBatchSizeValue = useCallback(() => {
        return batchSizeMap[batchSize] || 10;
    }, [batchSize, batchSizeMap]);

    const value = useMemo(() => ({
        // Theme state
        isDarkMode,
        colors,

        // Appearance settings
        showMediaCounts,
        hideCompleted,
        compactView,

        // Organization settings
        sortMethod,
        autoRefresh,
        showProgress,
        excludedFolders,

        // Cleanup settings
        confirmBeforeDelete,
        saveDeletedHistory,
        autoBackup,
        batchSize,
        getBatchSizeValue,

        // Theme actions
        toggleDarkMode,

        // Appearance actions
        updateShowMediaCounts,
        updateHideCompleted,
        updateCompactView,

        // Organization actions
        updateSortMethod,
        updateAutoRefresh,
        updateShowProgress,
        updateExcludedFolders,

        // Cleanup actions
        updateConfirmBeforeDelete,
        updateSaveDeletedHistory,
        updateAutoBackup,
        updateBatchSize,

        // Constants
        batchSizeMap
    }), [
        isDarkMode,
        colors,
        showMediaCounts,
        hideCompleted,
        compactView,
        sortMethod,
        autoRefresh,
        showProgress,
        excludedFolders,
        confirmBeforeDelete,
        saveDeletedHistory,
        autoBackup,
        batchSize,
        getBatchSizeValue,
        toggleDarkMode,
        updateShowMediaCounts,
        updateHideCompleted,
        updateCompactView,
        updateSortMethod,
        updateAutoRefresh,
        updateShowProgress,
        updateExcludedFolders,
        updateConfirmBeforeDelete,
        updateSaveDeletedHistory,
        updateAutoBackup,
        updateBatchSize,
        batchSizeMap
    ]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
} 