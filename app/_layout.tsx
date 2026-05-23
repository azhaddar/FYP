import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from '../contexts/AppContext';
import { NotificationHandler } from '../components/NotificationHandler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <StatusBar style="light" />
        <NotificationHandler />
        <Slot />
      </AppProvider>
    </GestureHandlerRootView>
  );
}
