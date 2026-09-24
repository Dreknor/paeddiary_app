import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { ActionSheetHost } from '@/components/ActionSheet';
import { ToastHost } from '@/components/Toast';
import { Loading } from '@/components/ui';
import { CACHE_MAX_AGE_MS, persistOptions } from '@/sync/queryPersistence';
import { colors } from '@/theme';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Muss ≥ maxAge des Persisters sein, sonst verfällt der Offline-Cache vorzeitig.
        gcTime: CACHE_MAX_AGE_MS,
        networkMode: 'offlineFirst',
        // Keine Wiederholung bei fachlichen Fehlern (401/403/404/422), nur bei Netz-/Serverfehlern.
        retry: (count, error) =>
          count < 2 && (!(error instanceof ApiError) || error.isNetworkError || error.status >= 500),
      },
    },
  });
}

function RootNavigator({ restored }: { restored: boolean }) {
  const { status } = useAuth();
  // Erst anzeigen, wenn der gespeicherte Cache geladen ist – sonst wirken Listen offline leer.
  if (status === 'loading' || (status === 'signedIn' && !restored)) return <Loading />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={status === 'needsServer'}>
        <Stack.Screen name="server" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      {/* Deep Links: paeddiary://connect?server=… und SSO-Rücksprung paeddiary://auth */}
      <Stack.Screen name="connect" />
      <Stack.Screen name="auth" />
      {/* Schüler-iPad (ohne Lehrer-Anmeldung) und Deep Link paeddiary://join?server=…&code=… */}
      <Stack.Screen name="schueler-modus/index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="schueler-modus/bewertung" options={{ gestureEnabled: false }} />
      <Stack.Screen name="join" />
    </Stack>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [restored, setRestored] = useState(false);
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onSuccess={() => setRestored(true)}
        onError={() => setRestored(true)}
      >
        <AuthProvider>
          <StatusBar style="dark" />
          <RootNavigator restored={restored} />
          <ToastHost />
          <ActionSheetHost />
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
