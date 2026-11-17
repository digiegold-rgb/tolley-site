import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { downloadedFontExtension, patchFontLoader } from '../scripts/patch-next-font-loader.mjs';
const original = 'const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];';
test('downloaded font format comes from bytes, including extensionless Google URLs', () => {
  for (const [magic, expected] of [['wOF2','woff2'], ['wOFF','woff'], ['OTTO','otf'], ['\x00\x01\x00\x00','ttf'], ['true','ttf']]) {
    assert.equal(downloadedFontExtension(Buffer.from(magic, 'latin1')), expected);
    const result = vm.runInNewContext(patchFontLoader(original) + '\next;', {fontFileBuffer:Buffer.from(magic,'latin1'),googleFontFileUrl:'https://fonts.gstatic.com/l/font?kit=example&skey=example&v=v1'});
    assert.equal(result, expected);
  }
});
test('invalid downloads fail clearly instead of being assigned a fabricated extension', () => {
  assert.throws(()=>downloadedFontExtension(Buffer.from('<html>error</html>')),/Unsupported/);
  assert.throws(()=>downloadedFontExtension(Buffer.alloc(0)),/Unsupported/);
});
test('loader patch is idempotent and refuses an unexpected dependency implementation', () => {
  const patched=patchFontLoader(original);
  assert.equal(patchFontLoader(patched),patched);
  assert.throws(()=>patchFontLoader('different implementation'),/review or remove/);
  assert.throws(()=>patchFontLoader(original+original),/review or remove/);
});
