// App.js
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import { MediaProvider } from './src/contexts/MediaContext'
import { HistoryProvider } from './src/contexts/HistoryContext'

import BottomTabs from './src/components/BottomTabs'

export default function App() {
  return (
    <>
      <StatusBar hidden />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NavigationContainer>
            <HistoryProvider>
              <MediaProvider>
                <BottomTabs />
              </MediaProvider>
            </HistoryProvider>
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </>
  )
}
