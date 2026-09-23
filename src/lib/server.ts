/**
 * Normalisiert eine eingegebene Serveradresse:
 * `schule.de/` → `https://schule.de`, `https://schule.de/api/v1` → `https://schule.de`.
 * http:// bleibt erhalten (lokale Entwicklung), wird aber nie automatisch ergänzt.
 */
export function normalizeServerUrl(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  value = value.replace(/\/+$/, '').replace(/\/api(\/v1)?$/i, '');
  const match = /^(https?):\/\/([a-z0-9.-]+(?::\d+)?)(\/[^\s?#]*)?$/i.exec(value);
  if (!match) return null;
  return `${match[1].toLowerCase()}://${match[2].toLowerCase()}${match[3] ?? ''}`;
}

export function serverLabel(serverUrl: string) {
  return serverUrl.replace(/^https?:\/\//, '');
}
