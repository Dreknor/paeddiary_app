/** Hilfen für Routen-Parameter (Listen als `1,2,3` bzw. `Max M.|Lisa K.`). */

export function parseIdList(value: string | string[] | undefined): number[] {
  const raw = Array.isArray(value) ? value.join(',') : (value ?? '');
  return raw
    .split(',')
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export function parseNameList(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join('|') : (value ?? '');
  return raw ? raw.split('|') : [];
}

export const shortName = (firstname: string, lastname: string) =>
  `${firstname} ${lastname ? `${lastname.charAt(0)}.` : ''}`.trim();
