import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const electronVerifier = fs.readFileSync(new URL('./tooling/verify_ui_polish003_electron.cjs', import.meta.url), 'utf8');

const polishStart = css.indexOf('UI-POLISH-003: Action Path');
assert.ok(polishStart >= 0, 'UI-POLISH-003 CSS section must exist');
const polishCss = css.slice(polishStart, css.indexOf('Ordinary status labels', polishStart));
const pathLogicStart = logic.indexOf("const ACTION_PATH_COMPACT_MEDIA");
const pathLogicEnd = logic.indexOf('function handCode', pathLogicStart);
assert.ok(pathLogicStart >= 0 && pathLogicEnd > pathLogicStart, 'responsive Action Path implementation must be bounded');
const pathLogic = logic.slice(pathLogicStart, pathLogicEnd);

test('one Action Path panel and renderer move between full and compact mounts', () => {
  assert.equal((html.match(/id="playbookDecisionPathPanel"/g) || []).length, 1);
  assert.equal((html.match(/id="pathList"/g) || []).length, 1);
  assert.match(html, /id="playbookCompactActionPathMount"/);
  assert.match(html, /id="playbookActionPathRailMount"[\s\S]*id="playbookDecisionPathPanel"/);
  assert.match(pathLogic, /target\.append\(panel\)/);
  assert.doesNotMatch(pathLogic, /cloneNode|createElement\([^)]*path/i);
  assert.equal((logic.match(/function renderPath\(/g) || []).length, 1);
});

test('responsive selection responds to both Playbook width and viewport height', () => {
  assert.match(pathLogic, /ACTION_PATH_COMPACT_MEDIA = '\(max-width: 1499px\), \(max-height: 900px\)'/);
  assert.match(pathLogic, /window\.matchMedia\(ACTION_PATH_COMPACT_MEDIA\)/);
  assert.match(polishCss, /@media \(max-width: 1499px\), \(max-height: 900px\)/);
  assert.match(polishCss, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(polishCss, /\.path-current-summary/);
});

test('compact geometry is intrinsic, bounded, and does not mask overflow', () => {
  assert.match(polishCss, /\.playbook-action-path-mount--compact\s*\{[^}]*width: min\(100%, 720px\);[^}]*min-height: 0;[^}]*max-height: none;[^}]*overflow: visible;/s);
  assert.match(polishCss, /#playbookDecisionPathPanel\[data-action-path-presentation="compact"\]\s*\{[^}]*height: auto;[^}]*overflow: visible;/s);
  assert.doesNotMatch(polishCss, /#playbookDecisionPathPanel\[data-action-path-presentation="compact"\]\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(polishCss, /\.path-current-summary strong\s*\{[^}]*overflow-wrap: anywhere;/s);
  assert.match(electronVerifier, /compact panel vertically clips content/);
  assert.match(electronVerifier, /current branch collides with panel bottom/);
});

test('compact path preserves street progression, current state, branch summary, and truthful unavailable state', () => {
  for (const key of ['preflop', 'flop', 'turn', 'river']) {
    assert.match(pathLogic, new RegExp(`key: '${key}'`));
  }
  assert.match(pathLogic, /aria-current="step"/);
  assert.match(pathLogic, /t\('Current street'\)/);
  assert.match(pathLogic, /class="path-current-summary"/);
  assert.match(pathLogic, /const branchSummary = `\$\{heroPos\} · \$\{t\(lastActionText\)\}`/);
  assert.match(pathLogic, /function renderUnavailableActionPath\(message, state = 'unavailable'\)/);
  assert.match(pathLogic, /class="action-path-unavailable" role="status"/);
});

test('details disclosure is localized, keyboard-native, and not globally persisted', () => {
  assert.match(html, /id="actionPathDetailsToggle"[^>]+type="button"[^>]+aria-expanded="false"[^>]+aria-controls="pathList"/);
  assert.match(pathLogic, /toggle\.addEventListener\('click'/);
  assert.match(pathLogic, /t\(expanded \? 'Collapse details' : 'Expand details'\)/);
  assert.doesNotMatch(pathLogic, /localStorage|sessionStorage/);
  for (const key of ['Collapse details', 'Expand details', 'Current branch', 'Current street', 'Street progression']) {
    assert.equal((translations.match(new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')) || []).length, 2, `${key} must have RU and HE entries`);
  }
});

test('Daylight table uses semantic theme-derived tokens while Midnight token values remain unchanged', () => {
  const daylightBlocks = [...css.matchAll(/\[data-theme="daylight"\]\s*\{([\s\S]*?)\n\}/g)].map((match) => match[1]);
  const pokerDaylight = daylightBlocks.find((block) => block.includes('--poker-table-rail-start')) || '';
  assert.match(pokerDaylight, /--poker-table-rail-start: color-mix\(in srgb, var\(--surface-shell\)/);
  assert.match(pokerDaylight, /--poker-table-surface-start: color-mix\(in srgb, var\(--accent-secondary\)/);
  assert.match(pokerDaylight, /--poker-table-surface-end: color-mix\(in srgb, var\(--accent-primary\)/);
  assert.match(pokerDaylight, /--poker-table-seat: var\(--surface-elevated\)/);
  assert.match(pokerDaylight, /--poker-table-shadow-opacity: 0\.14/);

  const rootPoker = css.slice(css.indexOf('/* DESIGN-005: poker visual system'), css.indexOf('[data-theme="graphite"]', css.indexOf('/* DESIGN-005: poker visual system')));
  assert.match(rootPoker, /--poker-table-rail-start: #29312d/);
  assert.match(rootPoker, /--poker-table-rail-end: #101512/);
  assert.match(rootPoker, /--poker-table-surface-start: #204b3a/);
  assert.match(rootPoker, /--poker-table-surface-end: #112c22/);
  assert.match(rootPoker, /--poker-table-shadow-opacity: 0\.28/);
});

test('table geometry and card, chip, seat, dealer, and contribution hooks are unchanged and readable', () => {
  assert.match(table, /class="table-rail" x="50" y="50" width="700" height="400" rx="200" ry="200"/);
  assert.match(table, /class="table-surface" x="70" y="70" width="660" height="360" rx="180" ry="180"/);
  assert.match(table, /class="table-betting-line" x="100" y="100" width="600" height="300" rx="150" ry="150"/);
  assert.match(table, /class="table-shadow-effect" dx="0" dy="7" stdDeviation="8" flood-opacity="0\.28"/);
  for (const hook of ['table-seat', 'table-hole-cards', 'table-contribution', 'table-pot', 'table-dealer-button']) {
    assert.match(table, new RegExp(hook));
  }
  assert.match(html, /id="savedStudySaveButton"/);
  assert.match(html, /id="handSavedStudyActionMount"/);
  assert.match(html, /id="replaySavedStudyActionMount"/);
});

test('responsive presentation code does not resolve strategy, Equity, Training, or poker accounting', () => {
  assert.doesNotMatch(pathLogic, /strategyProvider\.resolve|calculateEquity|Training|PokerState|potBb\s*[+\-*/]=/);
});
