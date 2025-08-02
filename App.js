// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { MediaProvider } from './src/contexts/MediaContext';
import { HistoryProvider } from './src/contexts/HistoryContext';
import { AppStateProvider } from './src/contexts/AppStateContext';

import BottomTabs from './src/components/BottomTabs';
import Cleanup from './src/screens/Cleanup';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar hidden />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NavigationContainer>
            <AppStateProvider>
              <HistoryProvider>
                <MediaProvider>
                  <Stack.Navigator>
                    {/* Main app with bottom tabs */}
                    <Stack.Screen
                      name="Main"
                      component={BottomTabs}
                      options={{ headerShown: false }}
                    />
                    {/* Cleanup screen */}
                    <Stack.Screen
                      name="Cleanup"
                      component={Cleanup}
                      options={{
                        headerShown: false,
                        presentation: 'modal'
                      }}
                    />
                  </Stack.Navigator>
                </MediaProvider>
              </HistoryProvider>
            </AppStateProvider>
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  );
}