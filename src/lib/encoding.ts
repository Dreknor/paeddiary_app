/** UTF-8 und Base64 ohne Abhängigkeit von TextEncoder/Buffer (Hermes-sicher). */

type Coder = { encode?: (text: string) => Uint8Array; decode?: (bytes: Uint8Array) => string };
const g = globalThis as { TextEncoder?: new () => Coder; TextDecoder?: new (label?: string) => Coder };

export function utf8Encode(text: string): Uint8Array {
  // Hermes bringt TextEncoder mit (nativ, schnell); sonst von Hand.
  if (g.TextEncoder) return new g.TextEncoder().encode!(text);
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return new Uint8Array(bytes);
}

export function utf8Decode(bytes: Uint8Array): string {
  if (g.TextDecoder) {
    try {
      return new g.TextDecoder('utf-8').decode!(bytes);
    } catch {
      // Hermes-Versionen ohne vollständigen TextDecoder → Fallback
    }
  }
  // Zeichen gesammelt umwandeln statt `out +=` je Zeichen (große Caches).
  const parts: string[] = [];
  const codes: number[] = [];
  const flush = () => {
    parts.push(String.fromCharCode(...codes));
    codes.length = 0;
  };
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++];
    let code: number;
    if (b < 0x80) code = b;
    else if (b < 0xe0) code = ((b & 31) << 6) | (bytes[i++] & 63);
    else if (b < 0xf0) code = ((b & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    else code = ((b & 7) << 18) | ((bytes[i++] & 63) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
    if (code >= 0x10000) {
      code -= 0x10000;
      codes.push(0xd800 + (code >> 10), 0xdc00 + (code & 1023));
    } else codes.push(code);
    if (codes.length >= 8192) flush();
  }
  flush();
  return parts.join('');
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += ALPHABET[a >> 2] + ALPHABET[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? ALPHABET[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? ALPHABET[c & 63] : '=';
  }
  return out;
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => (i + k < clean.length ? ALPHABET.indexOf(clean[i + k]) : 0));
    bytes.push((n[0] << 2) | (n[1] >> 4));
    if (i + 2 < clean.length) bytes.push(((n[1] & 15) << 4) | (n[2] >> 2));
    if (i + 3 < clean.length) bytes.push(((n[2] & 3) << 6) | n[3]);
  }
  return new Uint8Array(bytes);
}

export const textToBase64 = (text: string) => bytesToBase64(utf8Encode(text));
export const base64ToText = (base64: string) => utf8Decode(base64ToBytes(base64));
