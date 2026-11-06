// CI-FIX-001: a changed locale file (or the shell markup) must always select the terminology and
// i18n tests, so a wording regression such as "heuristic" cannot slip past `--changed`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const select = (...paths) => execFileSync(process.execPath, ['tools/run-tests.mjs', '--paths', paths.join(','), '--list'],
  { cwd: root, encoding: 'utf8' });

test('--changed on a locale file selects terms_heuristic001 and the i18n tests', () => {
  for (const file of ['app/src/locales/settings-translations.js', 'app/src/locales/product-translations.js']) {
    const out = select(file);
    for (const t of ['terms_heuristic001', 'i18n001_runtime_integrity', 'i18n_residue001', 'l10n001_native_terminology']) {
      assert.match(out, new RegExp(`tests/${t}\\.test\\.mjs`), `${file} must select ${t}`);
    }
  }
});

test('--changed on app/index.html selects terms_heuristic001', () => {
  assert.match(select('app/index.html'), /tests\/terms_heuristic001\.test\.mjs/);
});

test('an unrelated file does not pull in the terminology tests', () => {
  assert.doesNotMatch(select('app/src/application/home-view-model.mjs'), /terms_heuristic001/);
});
