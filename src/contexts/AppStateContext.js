import { createContext, useContext, useState } from 'react';

const AppStateContext = createContext();

export function AppStateProvider({ children }) {
    const [needsRefresh, setNeedsRefresh] = useState(true);

    return (
        <AppStateContext.Provider value={{
            needsRefresh,
            triggerRefresh: () => setNeedsRefresh(true),
            completeRefresh: () => setNeedsRefresh(false),
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