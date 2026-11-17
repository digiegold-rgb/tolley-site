/** Work around Next 16.3.4's Google font URL-extension assumption. Google also
 * serves valid fonts from extensionless /l/font?... URLs. Identify their real
 * container bytes instead of dereferencing a null URL regex match. Remove
 * this guarded patch when upgrading to a Next loader with a native fix. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);

export function downloadedFontExtension(bytes) {
  const signature = bytes.subarray(0, 4).toString('latin1');
  if (signature === 'wOF2') return 'woff2';
  if (signature === 'wOFF') return 'woff';
  if (signature === 'OTTO') return 'otf';
  if (signature === '\x00\x01\x00\x00' || signature === 'true') return 'ttf';
  throw new Error('Unsupported downloaded font container');
}

export function patchFontLoader(source) {
  const marker = '/* tolley-font-container-v1 */';
  if (source.includes(marker)) return source;
  const original = 'const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];';
  if (source.split(original).length !== 2) throw new Error('Next font loader changed; review or remove the font container patch.');
  return source.replace(original, `const ext = (${downloadedFontExtension.toString()})(fontFileBuffer); ${marker}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const filename = require.resolve('next/dist/compiled/@next/font/dist/google/loader.js');
  const source = readFileSync(filename, 'utf8');
  const patched = patchFontLoader(source);
  if (patched !== source) writeFileSync(filename, patched);
  console.log('Next Google font loader: container format detection ready.');
}
