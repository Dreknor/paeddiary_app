import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';

import { fetchInstance } from '@/api/endpoints';
import { useAuth } from '@/auth/AuthContext';
import { Loading } from '@/components/ui';
import { normalizeServerUrl, serverLabel } from '@/lib/server';

/** Deep Link `paeddiary://connect?server=https://…` (QR-Code im Web-Profil, Backend-Aufgabe B1). */
export default function ConnectScreen() {
  const { server: serverParam } = useLocalSearchParams<{ server?: string }>();
  const { status, server, selectServer } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const done = () => router.replace('/');
    const url = serverParam ? normalizeServerUrl(serverParam) : null;

    if (!url || server?.url === url) return done();
    if (status === 'signedIn' && server) {
      Alert.alert(
        'Bereits verbunden',
        `Du bist bei ${server.instance.name} angemeldet. Melde dich zuerst ab, um dich mit ${serverLabel(url)} zu verbinden.`,
      );
      return done();
    }

    fetchInstance(url)
      .then((instance) => selectServer(url, instance))
      .catch((e) => Alert.alert('Verbindung fehlgeschlagen', e instanceof Error ? e.message : String(e)))
      .finally(done);
  }, [serverParam, status, server, selectServer]);

  return <Loading />;
}
