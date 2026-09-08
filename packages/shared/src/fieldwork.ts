/** Only metadata/references cross sync. Image Blobs live in a separate local-only table. */
export interface FieldworkResponse {
  version: 1;
  contract: string;
  phase: 'build' | 'proof' | 'reasoning';
  configuration: Record<string, string>;
  explanations: Record<string, string>;
  tests: Record<string, { observed: string; status: 'unrecorded' | 'passed' | 'failed' }>;
  screenshots: Record<string, string>;
  reasoning: Record<string, string>;
  confirmed: boolean;
  checkpoint: string | null;
}
export interface EvidenceAsset {
  asset_id: string;
  attempt_id: string;
  exercise_id: string;
  item_key: string;
  mime_type: string;
  byte_length: number;
  checksum: string;
  width: number;
  height: number;
  status: 'pending' | 'uploading' | 'ready' | 'deleting' | 'deleted';
  deleted_at: string | null;
}
export const EVIDENCE_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  maxDimension: 8192,
  maxPixels: 32_000_000,
} as const;
/** Header-level format and dimension validation. No OCR, image inference, or provider calls. */
export function inspectEvidenceImage(bytes: Uint8Array, declared: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at: number, length: number) =>
    String.fromCharCode(...bytes.slice(at, at + length));
  let mime = '',
    width = 0,
    height = 0;
  if (
    bytes.length > 44 &&
    bytes[0] === 137 &&
    ascii(1, 7) === 'PNG\r\n\x1a\n' &&
    ascii(12, 4) === 'IHDR' &&
    ascii(bytes.length - 8, 4) === 'IEND'
  ) {
    mime = 'image/png';
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (
    bytes.length > 20 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[bytes.length - 2] === 255 &&
    bytes[bytes.length - 1] === 217
  ) {
    mime = 'image/jpeg';
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at++] !== 255) break;
      while (bytes[at] === 255) at++;
      const marker = bytes[at++]!;
      if (marker === 218 || marker === 217) break;
      const length = view.getUint16(at);
      if (length < 2 || at + length > bytes.length) break;
      if ([192, 193, 194].includes(marker) && length >= 8) {
        height = view.getUint16(at + 3);
        width = view.getUint16(at + 5);
        break;
      }
      at += length;
    }
  } else if (
    bytes.length >= 30 &&
    ascii(0, 4) === 'RIFF' &&
    ascii(8, 4) === 'WEBP' &&
    view.getUint32(4, true) + 8 === bytes.length
  ) {
    mime = 'image/webp';
    const kind = ascii(12, 4);
    if (kind === 'VP8X') {
      width = 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16);
      height = 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16);
    } else if (kind === 'VP8L' && bytes[20] === 47) {
      const bits = view.getUint32(21, true);
      width = 1 + (bits & 16383);
      height = 1 + ((bits >>> 14) & 16383);
    } else if (kind === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
      width = view.getUint16(26, true) & 16383;
      height = view.getUint16(28, true) & 16383;
    }
  }
  if (
    mime !== declared ||
    !width ||
    !height ||
    bytes.length > EVIDENCE_LIMITS.maxBytes ||
    width > EVIDENCE_LIMITS.maxDimension ||
    height > EVIDENCE_LIMITS.maxDimension ||
    width * height > EVIDENCE_LIMITS.maxPixels
  )
    throw new Error(
      'Choose a PNG, JPEG or WebP up to 8 MB, 8192 pixels per side and 32 megapixels.',
    );
  return { mime_type: mime, width, height };
}
