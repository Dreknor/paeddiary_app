import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { apiBase, ApiError, currentAuth } from '@/api/client';

const pdfDir = () => new Directory(Paths.cache, 'dossiers');

/**
 * Dossier-PDF vom Server laden (serverseitig erzeugt, mit Schul-Logo) und über das
 * System-Teilen-Menü anzeigen, drucken oder weitergeben. Die Datei liegt nur im Cache.
 */
export async function openDossierPdf(
  studentId: number,
  params: { from_date?: string; to_date?: string; include_confidential?: boolean },
  fileName: string,
) {
  const { baseUrl, token } = currentAuth();
  if (!baseUrl || !token) throw new ApiError('Nicht angemeldet.', 401);

  const query = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');

  const dir = pdfDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, fileName.replace(/[^\w.-]+/g, '_'));

  let file: File;
  try {
    file = await File.downloadFileAsync(`${apiBase(baseUrl)}/students/${studentId}/dossier.pdf?${query}`, target, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' },
      idempotent: true,
    });
  } catch (e) {
    throw new ApiError(`PDF konnte nicht geladen werden. ${e instanceof Error ? e.message : ''}`.trim(), 0);
  }

  if (!(await Sharing.isAvailableAsync())) throw new ApiError('Teilen ist auf diesem Gerät nicht verfügbar.', 0);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Dossier' });
}

/** Zwischengespeicherte PDFs löschen (beim Abmelden). */
export function clearPdfCache() {
  const dir = pdfDir();
  if (dir.exists) dir.delete();
}
