// CI-FIX-001 / TEST-RUNNER-002: self-tests for tools/run-tests.mjs and tests/areas.json rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tests/areas.json'), 'utf8'));
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

test('TEST-RUNNER-002 (a): automatic css group matches manifest and selects direct + css-model.mjs tests', () => {
  const checkOut = execFileSync(process.execPath, ['tools/run-tests.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(checkOut, /areas\.json OK/);

  const cssSourceRe = /styles\.css|css-model\.mjs|appStyleSheet|StyleSheetModel|assertDeclared|assertCascaded/;
  const allTests = fs.readdirSync(path.join(root, 'tests')).filter((f) => /\.test\.m?js$/.test(f)).sort();
  const autoCss = allTests.filter((f) => cssSourceRe.test(fs.readFileSync(path.join(root, 'tests', f), 'utf8')));
  assert.deepEqual([...manifest.groups.css.tests].sort(), autoCss);

  const out = select('app/styles.css');
  for (const t of ['design002_theme_foundation.test.mjs', 'motion_foundation001.test.mjs', 'ds_tokens001.test.mjs']) {
    assert.match(out, new RegExp(`tests/${t.replace(/\./g, '\\.')}`), `app/styles.css must select ${t}`);
  }
});

test('TEST-RUNNER-002 (b1): a change under app/src/ui/ also runs locale_numbers001, motion_foundation001, ds_tokens001, and the design tests', () => {
  const out = select('app/src/ui/drill-components.mjs');
  const required = [
    'locale_numbers001.test.mjs',
    'motion_foundation001.test.mjs',
    'ds_tokens001.test.mjs',
    'design002_theme_foundation.test.mjs',
    'design003_app_shell.test.mjs',
    'design004_component_system.test.mjs',
    'design005_poker_visual_system.test.mjs',
    'design006_playbook_workspace.test.mjs',
    'design007_equity_workspace.test.mjs',
    'design008_training_presentation.test.mjs',
    'design008_training_workspace.test.mjs',
  ];
  for (const t of required) {
    assert.match(out, new RegExp(`tests/${t.replace(/\./g, '\\.')}`), `app/src/ui/drill-components.mjs must select ${t}`);
  }
});

test('TEST-RUNNER-002 (b2): a change to app/index.html or logic.js also runs the smoke group', () => {
  for (const file of ['app/index.html', 'app/src/core/logic.js', 'logic.js']) {
    const out = select(file);
    for (const smokeTest of manifest.groups.smoke.tests) {
      assert.match(out, new RegExp(`tests/${smokeTest.replace(/\./g, '\\.')}`), `${file} must select smoke test ${smokeTest}`);
    }
  }
});
