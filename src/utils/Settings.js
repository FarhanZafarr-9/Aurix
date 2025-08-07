import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_KEYS = {
    FOLDER_ITEM_LIMIT: '@Settings:FolderItemLimit',
    // Add other settings keys here
};

export const DEFAULT_SETTINGS = {
    [SETTINGS_KEYS.FOLDER_ITEM_LIMIT]: 10000,
};

export const getSetting = async (key) => {
    try {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
            return JSON.parse(value);
        }
        return DEFAULT_SETTINGS[key];
    } catch (error) {
        console.warn(`Failed to get setting for key: ${key}`, error);
        return DEFAULT_SETTINGS[key];
    }
};

export const setSetting = async (key, value) => {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Failed to save setting for key: ${key}`, error);
    }
};
