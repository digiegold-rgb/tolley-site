import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
// Use the same parser/formatter as our pinned Next worker launcher so quoted
// preload paths and other platform-provided options retain their meaning.
const { getParsedNodeOptions, formatNodeOptions } = require('next/dist/server/lib/utils');
export const BUILD_HEAP_MIB = 6144;

export function buildNodeOptions(options = getParsedNodeOptions()) {
  const normalized = { ...options };
  delete normalized['max_old_space_size'];
  delete normalized['max-old-space-size'];
  normalized['max-old-space-size'] = String(BUILD_HEAP_MIB);
  return formatNodeOptions(normalized);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { nodeOptions, execArgv } = buildNodeOptions();
  console.log(`Next build: ${BUILD_HEAP_MIB} MiB heap; inherited Node options normalized and platform hooks preserved.`);
  const child = spawn(process.execPath, [
    ...execArgv,
    `--max-old-space-size=${BUILD_HEAP_MIB}`,
    require.resolve('next/dist/bin/next'),
    'build', '--webpack',
  ], { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: nodeOptions } });
  child.on('error', () => { console.error('Could not start the Next build.'); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => { if (!child.killed) child.kill(signal); });
  }
}
