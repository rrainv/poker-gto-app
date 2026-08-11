import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../app/src/ui/dragAndDrop.js', import.meta.url), 'utf8');

function shellMarkup() {
  const start = html.indexOf('<div class="riverline-shell"');
  const end = html.indexOf('<div class="modal-backdrop"', start);
  assert.ok(start >= 0 && end > start, 'shell markup must wrap the mode workspaces');
  return html.slice(start, end);
}

test('the application opens directly into the workstation', () => {
  assert.doesNotMatch(html, /id="mainMenuOverlay"/);
  assert.doesNotMatch(html, /id="enterWorkstationBtn"/);
  assert.doesNotMatch(html, /valorant-menu-overlay/);
  assert.doesNotMatch(css, /valorant-menu-overlay|valorant-btn/);
  assert.match(html, /<div class="riverline-shell" data-active-mode="gto">/);
  assert.match(html, /<section id="gtoMode" class="mode-view active">/);
});

test('the shell exposes every current mode with structural active semantics', () => {
  const shell = shellMarkup();
  for (const mode of ['gto', 'equity', 'training', 'info']) {
    assert.match(shell, new RegExp(`class="mode-nav-item(?: active)?"[^>]*data-mode="${mode}"`));
  }
  assert.match(shell, /data-mode="gto"[^>]*aria-current="page"/);
  assert.match(shell, /data-mode="equity"[^>]*aria-current="false"/);
  assert.match(logic, /\$\$\('\.mode-nav-item\[data-mode\]'\)/);
  assert.match(logic, /item\.setAttribute\('aria-current', isActive \? 'page' : 'false'\)/);
  assert.match(logic, /activeView\.style\.display = 'block'/);
});

test('mode switching updates workspace context without touching poker state', () => {
  assert.match(html, /id="workspaceTitle"[^>]*>Playbook</);
  assert.match(html, /id="workspaceSubtitle"/);
  assert.match(logic, /shell\.dataset\.activeMode = mode/);
  assert.match(logic, /workspaceTitle\.textContent = t\(modeTitle\)/);
  assert.match(logic, /workspaceSubtitle\.textContent = t\(modeSubtitle\)/);
  assert.doesNotMatch(logic.slice(logic.indexOf("$$('.mode-nav-item[data-mode]')"), logic.indexOf("$$('.sub-tab')")), /DecisionContext|StrategyResult|calculateEquity|calculatePreflop/);
});

test('settings, language, audio, and sidebar collapse controls remain available', () => {
  const shell = shellMarkup();
  for (const id of ['openSettings', 'langToggle', 'audioToggleBtn', 'sidebarCollapseBtn']) {
    assert.match(shell, new RegExp(`id="${id}"`));
  }
  assert.match(logic, /\$\('#openSettings'\)\.addEventListener\('click'/);
  assert.match(html, /id="langToggle"[^>]*onchange="setLanguage\(this\.value\)"/);
  assert.match(sound, /btn\.setAttribute\('aria-pressed', String\(soundEnabled\)\)/);
  assert.match(logic, /button\.setAttribute\('aria-expanded', String\(!collapsed\)\)/);
  assert.doesNotMatch(shell, /id="lockUiBtn"/);
  assert.doesNotMatch(html, /src="src\/ui\/dragAndDrop\.js"/);
});

test('utility controls use coherent SVG icons and accessible flag-and-name language options', () => {
  const shell = shellMarkup();
  assert.match(shell, /id="audioToggleBtn"[\s\S]*?<svg/);
  assert.match(shell, /id="sidebarCollapseBtn"[\s\S]*?<svg/);
  assert.match(shell, /id="openSettings"[\s\S]*?<svg/);
  assert.doesNotMatch(shell, /🔊|🔇|🔒|🔓|⚙/u);
  assert.match(shell, /English/);
  assert.match(shell, /Русский/);
  assert.match(shell, /עברית/);
  assert.doesNotMatch(sound, /btn\.textContent\s*=/);
});

test('strategy source status distinguishes fallback, loading, available, and unavailable states', () => {
  assert.match(html, /id="connectApiBtn"[^>]*data-status="fallback"/);
  assert.match(html, /id="apiStatusText">Heuristic fallback</);
  for (const status of ['fallback', 'loading', 'available', 'unavailable']) {
    assert.match(css, new RegExp(`model-status\\[data-status="${status}"\\]`));
  }
  assert.match(logic, /setStrategySourceStatus\('loading', 'Loading model'\)/);
  assert.match(logic, /setStrategySourceStatus\('available', 'ONNX model'\)/);
  assert.match(logic, /setStrategySourceStatus\('fallback', 'Heuristic fallback'\)/);
  assert.match(logic, /setStrategySourceStatus\('unavailable', 'Model unavailable · heuristic'\)/);
});

test('mobile navigation and utilities remain visible and reachable', () => {
  const uiQaCss = css.slice(css.indexOf('UI-QA-001: responsive shell'));
  assert.match(uiQaCss, /@media \(max-width: 820px\)[\s\S]*?\.mode-navigation\s*\{\s*grid-template-columns: repeat\(4/);
  assert.match(uiQaCss, /@media \(max-width: 820px\)[\s\S]*?\.rail-utilities[\s\S]*?grid-template-columns: repeat\(3/);
  assert.doesNotMatch(uiQaCss, /\.mode-navigation\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(uiQaCss, /\.rail-utilities\s*\{[^}]*display:\s*none/);
});

test('the shell consumes semantic tokens and remains theme-independent', () => {
  const design003Css = css.slice(
    css.indexOf('DESIGN-003: Riverline application shell'),
    css.indexOf('DESIGN-004: shared component system'),
  );
  assert.match(design003Css, /background: var\(--surface-shell\)/);
  assert.match(design003Css, /background: var\(--accent-primary\)/);
  assert.match(design003Css, /border-color: var\(--border-subtle\)/);
  assert.doesNotMatch(design003Css, /\[data-theme="(?:midnight|graphite|daylight)"\]/);
  for (const theme of ['midnight', 'graphite', 'daylight']) {
    assert.match(css, new RegExp(`\\[data-theme="${theme}"\\]`));
  }
});
