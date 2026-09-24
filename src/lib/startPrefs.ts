import { useEffect, useSyncExternalStore } from 'react';

import type { WeekScope } from '@/api/types';

import { encryptedStore } from './encryptedStore';

/**
 * Was die Startseite zeigt – je Nutzer auf dem Gerät gespeichert.
 * Schlüssel: `c<id>` = Klasse, `g<id>` = Lerngruppe.
 */
export type StartKey = `c${number}` | `g${number}`;

export type StartPrefs = {
  /** In der Liste ausgeblendet. */
  hidden: StartKey[];
  /** Bei „Heute“ gezeigt; `null` = Standard (die ersten Klassen). */
  today: StartKey[] | null;
};

/** Je Eintrag bei „Heute“ ein Abruf – mehr lädt die Startseite nicht auf einmal. */
export const MAX_TODAY = 8;

const DEFAULTS: StartPrefs = { hidden: [], today: null };

export const classKey = (id: number): StartKey => `c${id}`;
export const groupKey = (id: number): StartKey => `g${id}`;

export function keyToScope(key: StartKey): WeekScope {
  const id = Number(key.slice(1));
  return key.startsWith('c') ? { classId: id } : { groupId: id };
}

const cache = new Map<number, StartPrefs>();
const loading = new Set<number>();
const listeners = new Set<() => void>();

const storageName = (userId: number) => `start-prefs-${userId}`;
const emit = () => listeners.forEach((l) => l());

function load(userId: number) {
  if (cache.has(userId) || loading.has(userId)) return;
  loading.add(userId);
  void encryptedStore
    .getItem(storageName(userId))
    .then((raw) => {
      let prefs = DEFAULTS;
      try {
        if (raw) prefs = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<StartPrefs>) };
      } catch {
        // Beschädigt → Standard.
      }
      // Wurde inzwischen gespeichert, gewinnt der neuere Stand.
      if (!cache.has(userId)) cache.set(userId, prefs);
    })
    .finally(() => {
      loading.delete(userId);
      emit();
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveStartPrefs(userId: number, prefs: StartPrefs) {
  cache.set(userId, prefs);
  emit();
  void encryptedStore.setItem(storageName(userId), JSON.stringify(prefs));
}

/** Einstellungen des Nutzers; `ready` = vom Gerät geladen. */
export function useStartPrefs(userId: number | undefined) {
  useEffect(() => {
    if (userId !== undefined) load(userId);
  }, [userId]);
  const prefs = useSyncExternalStore(subscribe, () => (userId === undefined ? undefined : cache.get(userId)));
  return { prefs: prefs ?? DEFAULTS, ready: prefs !== undefined };
}
