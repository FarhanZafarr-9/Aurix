import React, { createContext, useContext, useState } from 'react';

const AppStateContext = createContext();

export function AppStateProvider({ children }) {
    const [needsRefresh, setNeedsRefresh] = useState(true);
    const [theme, setTheme] = useState('dark'); // Example theme state

    return (
        <AppStateContext.Provider value={{
            needsRefresh,
            triggerRefresh: () => setNeedsRefresh(true),
            completeRefresh: () => setNeedsRefresh(false),
            theme,
            setTheme
        }}>
            {children}
        </AppStateContext.Provider>
    );
}

export function useAppState() {
    const context = useContext(AppStateContext);
    if (!context) throw new Error('useAppState must be used within AppStateProvider');
    return context;
}