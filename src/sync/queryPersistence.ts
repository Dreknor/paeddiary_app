import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import NetInfo from '@react-native-community/netinfo';
import { onlineManager, type Query } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { encryptedStore } from '@/lib/encryptedStore';

/** Gelesene Daten bleiben verschlüsselt auf dem Gerät, damit die App bei Netzabbruch weiter nutzbar ist. */
export const queryPersister = createAsyncStoragePersister({
  storage: encryptedStore,
  key: 'query-cache',
  throttleTime: 2000,
});

export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const persistOptions = {
  persister: queryPersister,
  maxAge: CACHE_MAX_AGE_MS,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Query) => query.state.status === 'success' && query.meta?.persist !== false,
  },
};

// TanStack Query über den Netzstatus informieren: offline pausieren, danach automatisch nachladen.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

/** Aktueller Netzstatus (wie TanStack Query ihn sieht). */
export function useIsOnline() {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
