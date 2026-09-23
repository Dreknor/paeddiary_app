import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { apiBase } from '@/api/client';
import { exchangeSsoCode } from '@/api/endpoints';
import type { TokenResponse } from '@/api/types';

function base64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createPkce() {
  const verifier = base64Url(Crypto.getRandomBytes(32));
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { verifier, challenge };
}

/** Fehlercodes des Backends (`AppSsoService`). */
const SSO_ERRORS: Record<string, string> = {
  sso_failed: 'Die Anmeldung mit dem Schulkonto ist fehlgeschlagen oder dein Konto ist nicht freigeschaltet.',
  sso_unavailable: 'Die Anmeldung mit dem Schulkonto ist auf diesem Server nicht eingerichtet.',
  access_denied: 'Die Anmeldung wurde abgebrochen.',
};

/**
 * SSO über das Laravel-Backend (Backend-Aufgabe B2):
 * System-Browser → Keycloak-Login des Backends → Rücksprung `paeddiary://auth?code&state`
 * → Einmal-Code + PKCE-Verifier gegen Sanctum-Token tauschen.
 *
 * Gibt `null` zurück, wenn der Nutzer den Browser schließt.
 */
export async function signInWithSso(serverUrl: string, deviceName: string): Promise<TokenResponse | null> {
  const { verifier, challenge } = await createPkce();
  const state = Crypto.randomUUID();
  // Im Build `paeddiary://auth`, in Expo Go `exp://…/--/auth` (muss dann im Backend erlaubt sein).
  const redirectUri = Linking.createURL('auth');

  const params = {
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  };
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  const result = await WebBrowser.openAuthSessionAsync(`${apiBase(serverUrl)}/auth/sso/start?${query}`, redirectUri);
  if (result.type !== 'success') return null;

  const { queryParams } = Linking.parse(result.url);
  if (queryParams?.state !== state) throw new Error('Die Anmeldung konnte nicht bestätigt werden (state).');
  if (typeof queryParams.error === 'string') {
    throw new Error(SSO_ERRORS[queryParams.error] ?? `Anmeldung fehlgeschlagen (${queryParams.error}).`);
  }
  if (typeof queryParams.code !== 'string') throw new Error('Der Server hat keinen Anmeldecode geliefert.');

  return exchangeSsoCode(serverUrl, queryParams.code, verifier, deviceName);
}
