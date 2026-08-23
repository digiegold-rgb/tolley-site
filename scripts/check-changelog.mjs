/**
 * check-changelog.mjs — fail the build when a deploy ships without a changelog
 * entry.
 *
 * lib/vater/changelog.ts documents a bump rule ("the CHANGELOG entry lands in
 * the SAME COMMIT as the feature"). Between 2026-08-15 and 2026-08-23 the site
 * shipped every day and APP_VERSION never moved off 1.3, so the in-app "What's
 * new" panel, the footer and GET /api/vater/changelog all told users nothing
 * had changed. A documented rule nobody enforces is a comment.
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../lib/vater/changelog.ts', import.meta.url), 'utf8');

const appVersion = src.match(/export const APP_VERSION = '([^']+)'/)?.[1];
const firstEntry = src.match(/CHANGELOG: ChangelogEntry\[\] = \[\s*\{\s*version: '([^']+)'/)?.[1];

if (!appVersion) {
  console.error('check-changelog: could not read APP_VERSION');
  process.exit(1);
}
if (!firstEntry) {
  console.error('check-changelog: could not read the newest CHANGELOG entry');
  process.exit(1);
}
if (appVersion !== firstEntry) {
  console.error(
    `check-changelog: APP_VERSION is ${appVersion} but the newest CHANGELOG entry is ${firstEntry}.\n` +
      'Add an entry for what you shipped (or fix the version) — see the BUMP RULE at the top of lib/vater/changelog.ts.',
  );
  process.exit(1);
}
console.log(`check-changelog: OK — v${appVersion}`);
