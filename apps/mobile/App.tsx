import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryProvider } from './src/providers/QueryProvider';
import { RootNavigator } from './src/navigation';
import { useConnectionStore } from './src/store';

export default function App() {
  const hydrate = useConnectionStore((state) => state.hydrate);

  // Rehydrate stored credentials from SecureStore on first mount
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </QueryProvider>
    </SafeAreaProvider>
  );
}
