import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireRenderDependencies } from './render-preflight.mjs';
test('rejects unavailable and invalid render dependencies before work', async () => {
  await assert.rejects(() => requireRenderDependencies('http://localhost:8188', async () => new Response('', { status: 502 })));
  await assert.rejects(() => requireRenderDependencies('http://localhost:8188', async () => Response.json({})));
  await assert.doesNotReject(() => requireRenderDependencies('http://localhost:8188', async () => Response.json({ devices: [] })));
});
