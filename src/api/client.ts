import { randomUUID } from 'expo-crypto';

const DEFAULT_TIMEOUT_MS = 15_000;

/** Fehler aus der API oder dem Netzwerk, mit deutscher Meldung für die Oberfläche. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP-Status; 0 = keine Verbindung / Zeitüberschreitung. */
    readonly status: number,
    readonly errors: Record<string, string[]> = {},
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError() {
    return this.status === 0;
  }

  /** Erste Validierungsmeldung zu einem Feld, falls vorhanden. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

type Config = {
  baseUrl: string | null;
  token: string | null;
  onUnauthorized: (() => void) | null;
};

const config: Config = { baseUrl: null, token: null, onUnauthorized: null };

/** Wird vom AuthProvider gesetzt, sobald Server bzw. Token bekannt sind. */
export function configureApi(next: Partial<Config>) {
  Object.assign(config, next);
}

/** `https://schule.de` → `https://schule.de/api/v1` */
export function apiBase(serverUrl: string) {
  return `${serverUrl}/api/v1`;
}

type RequestOptions = {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Für Wiederholungen aus der Warteschlange denselben Schlüssel übergeben. */
  idempotencyKey?: string;
  /** Abweichender Server (z. B. bei der Serverwahl, bevor die Konfiguration steht). */
  serverUrl?: string;
  /** Ohne Token senden (Login, Instanz-Info). */
  anonymous?: boolean;
  /** Abweichendes Token (Schüler-iPad); 401 meldet dann nicht die Lehrkraft ab. */
  authToken?: string;
  timeoutMs?: number;
};

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.',
  403: 'Dafür fehlt dir die Berechtigung.',
  404: 'Nicht gefunden.',
  409: 'Der Datensatz wurde inzwischen geändert.',
  422: 'Bitte überprüfe deine Eingaben.',
  429: 'Zu viele Versuche. Bitte warte kurz.',
};

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const server = options.serverUrl ?? config.baseUrl;
  if (!server) throw new ApiError('Es ist kein Server ausgewählt.', 0);

  // Kein `URL`/`URLSearchParams`: in React Native nur teilweise implementiert.
  const query = Object.entries(options.query ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  const url = apiBase(server) + path + (query ? `?${query}` : '');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = options.authToken ?? config.token;
  if (!options.anonymous && token) headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET') headers['Idempotency-Key'] = options.idempotencyKey ?? randomUUID();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('Keine Verbindung zum Server. Bitte prüfe das Netzwerk.', 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !options.anonymous && !options.authToken) config.onUnauthorized?.();
    const message =
      (typeof body?.message === 'string' && body.message) ||
      STATUS_MESSAGES[response.status] ||
      `Serverfehler (${response.status}).`;
    throw new ApiError(message, response.status, body?.errors ?? {}, body);
  }

  if (body === null) throw new ApiError('Unerwartete Antwort vom Server.', response.status);
  return body as T;
}

/** Aktuelles Token (z. B. für Datei-Downloads außerhalb von `fetch`). */
export function currentAuth() {
  return { baseUrl: config.baseUrl, token: config.token };
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, { ...options, body }),
  del: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};
