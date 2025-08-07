import { createContext, useContext, useState } from 'react';

const AppStateContext = createContext();

export function AppStateProvider({ children }) {
    const [needsRefresh, setNeedsRefresh] = useState(true);

    return (
        <AppStateContext.Provider value={{
            needsRefresh,
            triggerRefresh: () => {
                if (!needsRefresh) setNeedsRefresh(true);
            },

            completeRefresh: () => {
                if (needsRefresh) setNeedsRefresh(false);
            }

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