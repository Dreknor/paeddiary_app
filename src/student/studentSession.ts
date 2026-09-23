import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { joinAsStudent } from '@/api/endpoints';

/**
 * Schüler-iPad: Sitzung mit einem Schüler-Token (nur `/student/*`).
 * Unabhängig von einer Lehrer-Anmeldung; wird beim Ende der Bewertung verworfen.
 */

export type StudentDeviceSession = {
  serverUrl: string;
  token: string;
  expiresAt: string;
  firstname: string;
};

const KEY = 'paeddiary.studentSession';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export async function loadStudentSession(): Promise<StudentDeviceSession | null> {
  const raw = await SecureStore.getItemAsync(KEY, options);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as StudentDeviceSession;
    if (new Date(s.expiresAt).getTime() < Date.now()) {
      await clearStudentSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export const clearStudentSession = () => SecureStore.deleteItemAsync(KEY, options);

export async function joinStudentSession(serverUrl: string, code: string): Promise<StudentDeviceSession> {
  const deviceName = `${Platform.OS === 'ios' ? (Platform.isPad ? 'iPad' : 'iPhone') : 'Android'} (Schüler)`;
  const response = await joinAsStudent(serverUrl, code.trim(), deviceName);
  const session: StudentDeviceSession = {
    serverUrl,
    token: response.token,
    expiresAt: response.expires_at,
    firstname: response.student.firstname,
  };
  await SecureStore.setItemAsync(KEY, JSON.stringify(session), options);
  return session;
}

/** Inhalt eines Beitritts-QR-Codes: `paeddiary://join?server=https://…&code=K7M4QX` */
export function parseJoinPayload(data: string): { server: string; code: string } | null {
  const match = /^paeddiary:\/\/join\?(.*)$/i.exec(data.trim());
  if (!match) return null;
  const params = Object.fromEntries(
    match[1].split('&').map((pair) => {
      const [k, v = ''] = pair.split('=');
      return [decodeURIComponent(k), decodeURIComponent(v)];
    }),
  );
  return params.server && params.code ? { server: params.server, code: params.code } : null;
}
