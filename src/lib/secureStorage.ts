import * as SecureStore from 'expo-secure-store';

import type { CurrentUser, InstanceInfo } from '@/api/types';

/** Gespeicherte Sitzung. Liegt im Keychain (iOS) bzw. Keystore (Android). */
export type StoredServer = { url: string; instance: InstanceInfo };

const KEYS = {
  server: 'paeddiary.server',
  token: 'paeddiary.token',
  user: 'paeddiary.user',
} as const;

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key, options);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const secureStorage = {
  loadServer: () => readJson<StoredServer>(KEYS.server),
  saveServer: (server: StoredServer) => SecureStore.setItemAsync(KEYS.server, JSON.stringify(server), options),
  clearServer: () => SecureStore.deleteItemAsync(KEYS.server, options),

  loadToken: () => SecureStore.getItemAsync(KEYS.token, options),
  loadUser: () => readJson<CurrentUser>(KEYS.user),
  saveSession: async (token: string, user: CurrentUser) => {
    await SecureStore.setItemAsync(KEYS.token, token, options);
    await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user), options);
  },
  clearSession: async () => {
    await SecureStore.deleteItemAsync(KEYS.token, options);
    await SecureStore.deleteItemAsync(KEYS.user, options);
  },
};
