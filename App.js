// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { MediaProvider } from './src/contexts/MediaContext';
import { HistoryProvider } from './src/contexts/HistoryContext';
import { AppStateProvider } from './src/contexts/AppStateContext';
import { ThemeProvider } from './src/contexts/ThemeContext';

import { useEffect } from 'react';
import { AppState } from 'react-native';
import BottomTabs from './src/components/BottomTabs';
import Cleanup from './src/screens/Cleanup';
import { useTheme } from './src/contexts/ThemeContext';
import { useMedia } from './src/contexts/MediaContext';
import { useAppState } from './src/contexts/AppStateContext';

const Stack = createNativeStackNavigator();

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

function MainApp() {
  const { autoRefresh } = useTheme();
  const { lastRefreshed, refreshAllData } = useMedia();
  const { triggerRefresh } = useAppState();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        if (autoRefresh) {
          const now = new Date().getTime();
          const last = lastRefreshed ? new Date(lastRefreshed).getTime() : 0;
          if (now - last > REFRESH_INTERVAL) {
            refreshAllData(true);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [autoRefresh, lastRefreshed, refreshAllData]);

  return (
    <Stack.Navigator>
      <Stack.Screen name="Main" component={BottomTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Cleanup" component={Cleanup} options={{ headerShown: false, presentation: 'modal' }} />
    </Stack.Navigator>
  );
}


export default function App() {
  return (
    <>
      <StatusBar hidden />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AppStateProvider>
              <MediaProvider>
                <HistoryProvider>
                  <NavigationContainer>
                    <MainApp />
                  </NavigationContainer>
                </HistoryProvider>
              </MediaProvider>
            </AppStateProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}