import { readdirSync, readFileSync } from 'node:fs';
import catalogData from '../shared/psl-sign-catalog.json' with { type: 'json' };

// Shared with the app's offline sign library so meanings stay consistent.
export const pslSignCatalog = Object.freeze(catalogData);

export function validatePslSignCatalog(catalog = pslSignCatalog) {
  if (!Array.isArray(catalog) || catalog.length > 10) throw new Error('PSL sign catalog must contain at most 10 signs.');
  const ids = new Set();
  for (const sign of catalog) {
    if (!sign || Object.keys(sign).sort().join(',') !== 'id,nameEn,nameUr,visualCue' ||
        !/^[a-z0-9_-]{1,40}$/u.test(sign.id) || ids.has(sign.id) ||
        typeof sign.nameEn !== 'string' || !sign.nameEn.trim() || sign.nameEn.length > 80 ||
        typeof sign.nameUr !== 'string' || !sign.nameUr.trim() || sign.nameUr.length > 80 ||
        typeof sign.visualCue !== 'string' || !sign.visualCue.trim() || sign.visualCue.length > 240 ||
        /[\p{Cc}\p{Cf}]/u.test(`${sign.nameEn}${sign.nameUr}${sign.visualCue}`)) {
      throw new Error('Invalid PSL sign catalog entry.');
    }
    ids.add(sign.id);
  }
  return catalog;
}

export function loadPslSignReferences(catalog = pslSignCatalog) {
  validatePslSignCatalog(catalog);
  if (!catalog.length) return [];
  const directory = new URL('../PSL-Images/', import.meta.url);
  const files = readdirSync(directory, { withFileTypes: true });
  const symbolDirectory = new URL('../assets/psl-signs/', import.meta.url);
  const symbolFiles = readdirSync(symbolDirectory, { withFileTypes: true });
  let totalBytes = 0;
  return catalog.map(sign => {
    const file = files.find(entry => entry.isFile() && new RegExp(`^${sign.id}\\.(jpe?g|png|webp)$`, 'iu').test(entry.name));
    if (!file) throw new Error(`Missing PSL reference image for sign "${sign.id}".`);
    const mimeType = /\.jpe?g$/iu.test(file.name) ? 'image/jpeg' : /\.png$/iu.test(file.name) ? 'image/png' : 'image/webp';
    const bytes = readFileSync(new URL(encodeURIComponent(file.name), directory));
    const symbolFile = symbolFiles.find(entry => entry.isFile() && new RegExp(`^${sign.id}\\.jpe?g$`, 'iu').test(entry.name));
    if (!symbolFile) throw new Error(`Missing PSL symbol image for sign "${sign.id}".`);
    const symbolMimeType = 'image/jpeg';
    const symbolBytes = readFileSync(new URL(encodeURIComponent(symbolFile.name), symbolDirectory));
    totalBytes += bytes.length + symbolBytes.length;
    if (bytes.length < 24 || bytes.length > 512 * 1024 || symbolBytes.length < 24 || symbolBytes.length > 512 * 1024 || totalBytes > 4 * 1024 * 1024 ||
        !matchesMime(bytes, mimeType) || !matchesMime(symbolBytes, symbolMimeType)) {
      throw new Error(`PSL reference "${sign.id}" must be a valid image under 512 KB; total references must stay under 4 MB.`);
    }
    return { ...sign, mimeType, base64: bytes.toString('base64'), symbolMimeType, symbolBase64: symbolBytes.toString('base64') };
  });
}

function matchesMime(bytes, mimeType) {
  return mimeType === 'image/jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) :
    mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
      bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}
