import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { configureApi } from '@/api/client';
import { fetchMe, loginWithPassword, revokeToken } from '@/api/endpoints';
import type { CurrentUser, InstanceInfo, TokenResponse } from '@/api/types';
import { encryptedStore } from '@/lib/encryptedStore';
import { clearPdfCache } from '@/lib/pdf';
import { secureStorage, type StoredServer } from '@/lib/secureStorage';
import { clearOutbox, startOutbox, stopOutbox } from '@/sync/outbox';
import { queryPersister } from '@/sync/queryPersistence';

import { signInWithSso } from './sso';

export type AuthStatus = 'loading' | 'needsServer' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: AuthStatus;
  server: StoredServer | null;
  user: CurrentUser | null;
  selectServer: (url: string, instance: InstanceInfo) => Promise<void>;
  forgetServer: () => Promise<void>;
  signInPassword: (email: string, password: string) => Promise<void>;
  /** `false`, wenn der Nutzer den Browser ohne Anmeldung geschlossen hat. */
  signInSso: () => Promise<boolean>;
  /** Abmelden und alle lokalen Daten (Cache, nicht gesendete Einträge) löschen. */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function deviceName() {
  const device = Platform.OS === 'ios' ? (Platform.isPad ? 'iPad' : 'iPhone') : 'Android';
  return `${device} – Päd. Tagebuch`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [server, setServer] = useState<StoredServer | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);

  /**
   * Lokale Abmeldung: Token und zwischengespeicherte Schülerdaten entfernen.
   * Die Warteschlange bleibt erhalten (z. B. Token abgelaufen) und wird nach der
   * nächsten Anmeldung desselben Nutzers gesendet – außer `wipeAll` ist gesetzt.
   */
  const clearLocalSession = useCallback(
    async (wipeAll = false) => {
      stopOutbox();
      configureApi({ token: null });
      await secureStorage.clearSession();
      queryClient.clear();
      await queryPersister.removeClient();
      if (wipeAll) {
        await clearOutbox();
        await encryptedStore.clear();
        clearPdfCache();
      }
      setUser(null);
      setStatus('signedOut');
    },
    [queryClient],
  );

  useEffect(() => {
    configureApi({ onUnauthorized: () => void clearLocalSession() });
  }, [clearLocalSession]);

  // Gespeicherte Sitzung beim Start laden.
  useEffect(() => {
    (async () => {
      const storedServer = await secureStorage.loadServer();
      if (!storedServer) {
        setStatus('needsServer');
        return;
      }
      configureApi({ baseUrl: storedServer.url });
      setServer(storedServer);

      const [token, storedUser] = await Promise.all([secureStorage.loadToken(), secureStorage.loadUser()]);
      if (!token || !storedUser) {
        setStatus('signedOut');
        return;
      }
      configureApi({ token });
      setUser(storedUser);
      setStatus('signedIn');
      void startOutbox(queryClient, storedUser.id);

      // Rechte im Hintergrund aktualisieren; bei 401 greift onUnauthorized.
      fetchMe()
        .then(async (fresh) => {
          setUser(fresh);
          await secureStorage.saveSession(token, fresh);
        })
        .catch(() => {});
    })();
    // Nur beim Start ausführen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeSignIn = useCallback(
    async (response: TokenResponse) => {
      await secureStorage.saveSession(response.access_token, response.user);
      configureApi({ token: response.access_token });
      setUser(response.user);
      setStatus('signedIn');
      void startOutbox(queryClient, response.user.id);
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      server,
      user,
      selectServer: async (url, instance) => {
        const next = { url, instance };
        await secureStorage.saveServer(next);
        configureApi({ baseUrl: url });
        setServer(next);
        setStatus('signedOut');
      },
      forgetServer: async () => {
        await clearLocalSession(true);
        await secureStorage.clearServer();
        configureApi({ baseUrl: null });
        setServer(null);
        setUser(null);
        setStatus('needsServer');
      },
      signInPassword: async (email, password) => {
        if (!server) throw new Error('Es ist kein Server ausgewählt.');
        await completeSignIn(await loginWithPassword(server.url, email, password, deviceName()));
      },
      signInSso: async () => {
        if (!server) throw new Error('Es ist kein Server ausgewählt.');
        const response = await signInWithSso(server.url, deviceName());
        if (!response) return false;
        await completeSignIn(response);
        return true;
      },
      signOut: async () => {
        // Token serverseitig widerrufen; offline trotzdem lokal abmelden.
        await revokeToken().catch(() => {});
        await clearLocalSession(true);
      },
    }),
    [status, server, user, completeSignIn, clearLocalSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden.');
  return ctx;
}
