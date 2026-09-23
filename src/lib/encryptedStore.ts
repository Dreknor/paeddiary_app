import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

import { base64ToText, textToBase64 } from './encoding';

/**
 * Verschlüsselte Ablage für Cache und Warteschlange (AES-256-GCM).
 * Der Schlüssel liegt im Keychain/Keystore und verlässt das Gerät nicht;
 * die Dateien liegen im App-Dokumentenordner und sind ohne Schlüssel wertlos.
 */

const KEY_NAME = 'paeddiary.storageKey';
const dir = new Directory(Paths.document, 'secure');

let keyPromise: Promise<AESEncryptionKey> | null = null;

function getKey(): Promise<AESEncryptionKey> {
  keyPromise ??= (async () => {
    const stored = await SecureStore.getItemAsync(KEY_NAME, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    if (stored) return AESEncryptionKey.import(stored, 'base64');
    const key = await AESEncryptionKey.generate();
    await SecureStore.setItemAsync(KEY_NAME, await key.encoded('base64'), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return key;
  })();
  return keyPromise;
}

function fileFor(name: string) {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return new File(dir, `${name.replace(/[^a-z0-9._-]/gi, '_')}.bin`);
}

// Schreibvorgänge je Datei nacheinander ausführen, damit sich nichts überholt.
const queues = new Map<string, Promise<unknown>>();
function serialized<T>(name: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(name) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(task);
  queues.set(name, next);
  return next;
}

export const encryptedStore = {
  async getItem(name: string): Promise<string | null> {
    return serialized(name, async () => {
      const file = fileFor(name);
      if (!file.exists) return null;
      try {
        const sealed = AESSealedData.fromCombined(await file.base64());
        const plain = await aesDecryptAsync(sealed, await getKey(), { output: 'base64' });
        return base64ToText(plain as string);
      } catch {
        // Beschädigt oder Schlüssel neu (App neu installiert) → verwerfen.
        file.delete();
        return null;
      }
    });
  },

  async setItem(name: string, value: string): Promise<void> {
    return serialized(name, async () => {
      const sealed = await aesEncryptAsync(textToBase64(value), await getKey());
      const file = fileFor(name);
      file.write(await sealed.combined('base64'), { encoding: 'base64' });
    });
  },

  async removeItem(name: string): Promise<void> {
    return serialized(name, async () => {
      const file = fileFor(name);
      if (file.exists) file.delete();
    });
  },

  /** Alles löschen (Abmelden / Schule wechseln). */
  async clear(): Promise<void> {
    await Promise.all(queues.values());
    if (dir.exists) dir.delete();
  },
};
