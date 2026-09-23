import NetInfo from '@react-native-community/netinfo';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { ApiError, request } from '@/api/client';
import { encryptedStore } from '@/lib/encryptedStore';

/**
 * Warteschlange für schreibende Aufrufe.
 *
 * Der Server ist führend – die Warteschlange überbrückt nur Netzabbrüche:
 * - Jeder Auftrag wird sofort gesendet. Scheitert das am Netz (oder 5xx/429), bleibt er
 *   verschlüsselt gespeichert und wird automatisch wiederholt (Netz zurück, App aktiv, alle 30 s).
 * - Die ID des Auftrags ist der `Idempotency-Key` → Wiederholungen erzeugen keine Dubletten.
 * - Fachliche Fehler (4xx) werden als „fehlgeschlagen“ markiert und dem Nutzer angezeigt.
 */

export type OutboxKind = 'diary' | 'grading' | 'diagnostic' | 'other';

export type OutboxItem = {
  id: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  /** Für die Anzeige, z. B. „Tagebucheintrag · Max M.“ */
  label: string;
  kind: OutboxKind;
  /** Zusatzinfos für die Oberfläche (z. B. betroffene Schüler, Vorschau). Keine Logik. */
  meta?: Record<string, unknown>;
  /** Query-Keys, die nach erfolgreicher Übertragung neu geladen werden. */
  invalidate: QueryKey[];
  /** Auftrag gehört zu diesem Nutzer – andere Nutzer senden ihn nie. */
  userId: number;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'failed';
  error?: string;
};

export type NewOutboxItem = Omit<OutboxItem, 'id' | 'userId' | 'createdAt' | 'attempts' | 'status' | 'error'>;

export type SendResult<T> = { status: 'sent'; data: T } | { status: 'queued'; id: string };

const STORAGE_NAME = 'outbox';
const RETRY_INTERVAL_MS = 30_000;

let items: OutboxItem[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;
let flushing = false;
let queryClient: QueryClient | null = null;
let currentUserId: number | null = null;
const listeners = new Set<() => void>();
const waiters = new Map<string, { resolve: (r: SendResult<any>) => void; reject: (e: unknown) => void }>();

function emit() {
  listeners.forEach((l) => l());
}

async function persist() {
  await encryptedStore.setItem(STORAGE_NAME, JSON.stringify(items));
}

function update(next: OutboxItem[]) {
  items = next;
  emit();
  void persist();
}

/** Vorübergehende Fehler → später erneut versuchen. */
function isTransient(error: unknown) {
  if (!(error instanceof ApiError)) return true;
  // 409 ohne `data` = parallele Anfrage mit gleichem Idempotency-Key → später erneut.
  const idempotencyBusy = error.status === 409 && !(error.body as any)?.data;
  return error.isNetworkError || error.status >= 500 || error.status === 429 || error.status === 401 || idempotencyBusy;
}

async function sendItem(item: OutboxItem) {
  return request<unknown>(item.method, item.path, { body: item.body, idempotencyKey: item.id });
}

function onSent(item: OutboxItem, data: unknown) {
  update(items.filter((i) => i.id !== item.id));
  item.invalidate.forEach((queryKey) => void queryClient?.invalidateQueries({ queryKey }));
  waiters.get(item.id)?.resolve({ status: 'sent', data });
  waiters.delete(item.id);
}

/** Alle offenen Aufträge der Reihe nach senden. */
export async function flushOutbox() {
  if (flushing || !loaded || currentUserId === null) return;
  flushing = true;
  try {
    for (const item of [...items]) {
      if (item.status !== 'pending' || item.userId !== currentUserId) continue;
      try {
        const data = await sendItem(item);
        onSent(item, data);
      } catch (error) {
        const attempts = item.attempts + 1;
        if (isTransient(error)) {
          update(items.map((i) => (i.id === item.id ? { ...i, attempts } : i)));
          // Beim ersten Versuch dem Aufrufer melden: offline gespeichert.
          waiters.get(item.id)?.resolve({ status: 'queued', id: item.id });
          waiters.delete(item.id);
          break; // Reihenfolge wahren – nächste Runde später.
        }
        const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
        const waiter = waiters.get(item.id);
        if (waiter) {
          // Aufrufer wartet noch (Formular offen) → Fehler direkt dort anzeigen, Auftrag verwerfen.
          update(items.filter((i) => i.id !== item.id));
          waiter.reject(error);
          waiters.delete(item.id);
        } else {
          update(items.map((i) => (i.id === item.id ? { ...i, attempts, status: 'failed', error: message } : i)));
        }
      }
    }
  } finally {
    flushing = false;
  }
}

/**
 * Auftrag einreihen und sofort senden.
 * - `sent`: vom Server bestätigt (mit Antwort)
 * - `queued`: offline gespeichert, wird automatisch nachgesendet
 * - wirft `ApiError` bei fachlichem Fehler (z. B. 403/422) – nichts bleibt in der Warteschlange.
 */
export async function sendViaOutbox<T = unknown>(input: NewOutboxItem): Promise<SendResult<T>> {
  // Erst gespeicherte Aufträge laden, sonst würden sie beim Speichern überschrieben.
  await loadPromise;
  if (currentUserId === null) throw new Error('Nicht angemeldet.');
  const item: OutboxItem = {
    ...input,
    id: randomUUID(),
    userId: currentUserId,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
  };
  const promise = new Promise<SendResult<T>>((resolve, reject) => waiters.set(item.id, { resolve, reject }));
  update([...items, item]);
  if (flushing) {
    // Läuft bereits eine Runde (z. B. hängt ein älterer Auftrag), nicht warten.
    waiters.get(item.id)?.resolve({ status: 'queued', id: item.id });
    waiters.delete(item.id);
  } else {
    void flushOutbox().then(() => {
      // Wurde der Auftrag nicht erreicht (älterer hängt), gilt er als eingereiht.
      waiters.get(item.id)?.resolve({ status: 'queued', id: item.id });
      waiters.delete(item.id);
    });
  }
  return promise;
}

export function retryOutboxItem(id: string) {
  update(items.map((i) => (i.id === id ? { ...i, status: 'pending', error: undefined } : i)));
  void flushOutbox();
}

export function discardOutboxItem(id: string) {
  update(items.filter((i) => i.id !== id));
}

export async function clearOutbox() {
  items = [];
  emit();
  await encryptedStore.removeItem(STORAGE_NAME);
}

export function getOutboxItems() {
  return items;
}

export function pendingCountForCurrentUser() {
  return items.filter((i) => i.userId === currentUserId).length;
}

/** Nach jeder Anmeldung aufrufen. Aufträge anderer Nutzer werden verworfen. */
export async function startOutbox(client: QueryClient, userId: number) {
  queryClient = client;
  currentUserId = userId;
  if (!loadPromise) {
    loadPromise = encryptedStore.getItem(STORAGE_NAME).then((raw) => {
      try {
        items = [...(raw ? (JSON.parse(raw) as OutboxItem[]) : []), ...items];
      } catch {
        // unlesbar → verwerfen
      }
      loaded = true;
    });

    NetInfo.addEventListener((state) => {
      if (state.isConnected) void flushOutbox();
    });
    AppState.addEventListener('change', (s) => {
      if (s === 'active') void flushOutbox();
    });
    setInterval(() => {
      if (items.some((i) => i.status === 'pending')) void flushOutbox();
    }, RETRY_INTERVAL_MS);
  }
  await loadPromise;
  if (items.some((i) => i.userId !== userId)) update(items.filter((i) => i.userId === userId));
  else emit();
  void flushOutbox();
}

/** Beim Abmelden: nichts mehr senden, Aufträge bleiben (bis zur ausdrücklichen Löschung) erhalten. */
export function stopOutbox() {
  currentUserId = null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOutbox() {
  return useSyncExternalStore(subscribe, getOutboxItems);
}

/** Offene Aufträge einer Art, optional gefiltert (z. B. Tagebuch eines Schülers). */
export function useOutboxItems(kind: OutboxKind, filter?: (item: OutboxItem) => boolean) {
  const all = useOutbox();
  return all.filter((i) => i.kind === kind && (!filter || filter(i)));
}
