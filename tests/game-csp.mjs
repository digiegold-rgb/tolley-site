import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import configModule from '../next.config.ts';

assert.equal(process.env.NODE_ENV, 'production', 'Run with NODE_ENV=production to test the deployed policy.');
const config = configModule.default ?? configModule;
const rules = await config.headers();
const global = rules.find(rule => rule.source === '/:path*');
const game = rules.find(rule => rule.source === '/game/:path*');
assert.ok(global && game);
const document = `<script>
  window.result = { wasm: null, evalBlocked: false };
  try { eval('1 + 1'); } catch { window.result.evalBlocked = true; }
  WebAssembly.compile(new Uint8Array([0,97,115,109,1,0,0,0]))
    .then(() => window.result.wasm = true, () => window.result.wasm = false);
</script>`;
const server = createServer((req, res) => {
  if (req.url === '/api/csp-report') { res.writeHead(204); res.end(); return; }
  for (const header of global.headers) res.setHeader(header.key, header.value);
  if (/^\/game(?:\/|$)/.test(req.url)) for (const header of game.headers) res.setHeader(header.key, header.value);
  res.setHeader('Content-Type', 'text/html'); res.end(document);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const path of ['/', '/game', '/game/adventure', '/game/classic', '/game-other']) {
    await page.goto(`http://127.0.0.1:${server.address().port}${path}`);
    await page.waitForFunction(() => window.result?.wasm !== null);
    const result = await page.evaluate(() => window.result);
    assert.equal(result.wasm, path === '/game' || path.startsWith('/game/'), `${path}: WebAssembly permission`);
    assert.equal(result.evalBlocked, true, `${path}: JavaScript eval must stay blocked`);
  }
  console.log('Production CSP: game WebAssembly works; JavaScript eval and unrelated-route WebAssembly remain blocked.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
