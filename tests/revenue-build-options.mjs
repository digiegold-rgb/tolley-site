import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'tolley build options '));
try {
  const preload = join(dir, 'platform hook.cjs');
  writeFileSync(preload, 'globalThis.__tolleyBuildPreload = true;\n');
  const helper = pathToFileURL(resolve('scripts/build-next.mjs')).href;
  const probe = `
    const v8 = require('node:v8');
    const { getParsedNodeOptions } = require('next/dist/server/lib/utils');
    console.log(JSON.stringify({
      heapMiB: Math.round(v8.getHeapStatistics().heap_size_limit / 1048576),
      compilerOptions: getParsedNodeOptions(),
      preloaded: globalThis.__tolleyBuildPreload === true,
    }));
  `;
  for (const spelling of ['max-old-space-size', 'max_old_space_size']) {
    const outer = `
      import { spawnSync } from 'node:child_process';
      import { buildNodeOptions } from ${JSON.stringify(helper)};
      const { nodeOptions, execArgv } = buildNodeOptions();
      const result = spawnSync(process.execPath, [...execArgv, '-e', ${JSON.stringify(probe)}], {
        encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: nodeOptions },
      });
      if (result.error || result.status !== 0) {
        process.stderr.write(result.stderr || result.error?.message || 'Child probe failed');
        process.exit(1);
      }
      process.stdout.write(result.stdout);
    `;
    const outerPath = join(dir, `${spelling}.mjs`);
    writeFileSync(outerPath, outer);
    const result = spawnSync(process.execPath, ['--max-old-space-size=4096', outerPath], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: `--${spelling}=8192 --require ${JSON.stringify(preload)}` },
    });
    assert.equal(result.status, 0, result.stderr || 'Build option probe failed');
    const data = JSON.parse(result.stdout);
    assert.ok(data.heapMiB >= 6144 && data.heapMiB < 6600, 'Child heap must remain near 6 GiB');
    assert.equal(data.compilerOptions['max-old-space-size'], '6144');
    assert.equal(data.compilerOptions.max_old_space_size, undefined);
    assert.equal(data.preloaded, true, 'Preserve platform preload hooks with spaces in their paths');
  }
  console.log('PASS: inherited heap aliases are normalized and platform preload hooks remain active.');
} finally { rmSync(dir, { recursive: true, force: true }); }
