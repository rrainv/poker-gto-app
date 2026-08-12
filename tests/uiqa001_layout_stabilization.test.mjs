import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const strategy = [
  '../app/src/strategy/preflop-heuristic.mjs',
  '../app/src/strategy/postflop-heuristic.mjs',
].map((url) => fs.readFileSync(new URL(url, import.meta.url), 'utf8')).join('\n');
const sound = fs.readFileSync(new URL('../app/src/core/SoundFX.js', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');

const uiQaStart = css.indexOf('UI-QA-001: responsive shell');
assert.ok(uiQaStart >= 0, 'UI-QA-001 stabilization section must exist');
const uiQaCss = css.slice(uiQaStart);

const shellHtml = html.slice(html.indexOf('<div class="riverline-shell"'), html.indexOf('<section id="gtoMode"'));
const railHtml = shellHtml.slice(shellHtml.indexOf('<aside'), shellHtml.indexOf('</aside>') + 8);
const headerHtml = shellHtml.slice(shellHtml.indexOf('<header class="workspace-header"'), shellHtml.indexOf('</header>') + 9);
const playbookHtml = html.slice(html.indexOf('id="gtoMode"'), html.indexOf('id="trainingMode"'));
const trainingHtml = html.slice(html.indexOf('id="trainingMode"'), html.indexOf('id="equityMode"'));
const equityHtml = html.slice(html.indexOf('id="equityMode"'), html.indexOf('id="infoMode"'));

test('sidebar has explicit expanded and collapsed states with accessible control', () => {
  assert.match(railHtml, /id="sidebarCollapseBtn"[^>]+aria-expanded="true"[^>]+aria-controls="modeRail"/);
  assert.match(logic, /function applySidebarState\(collapsed\)/);
  assert.match(logic, /riverline_sidebar_collapsed/);
  assert.match(uiQaCss, /\.riverline-shell\.is-sidebar-collapsed/);
  assert.match(uiQaCss, /--sidebar-expanded-width:\s*196px/);
  assert.match(uiQaCss, /--sidebar-collapsed-width:\s*64px/);
});

test('global utilities live in the lower sidebar and not the workspace header', () => {
  assert.match(railHtml, /class="rail-utilities"[\s\S]*id="langToggle"[\s\S]*id="audioToggleBtn"[\s\S]*id="openSettings"/);
  for (const id of ['langToggle', 'audioToggleBtn', 'openSettings']) {
    assert.doesNotMatch(headerHtml, new RegExp(`id="${id}"`));
  }
  assert.match(headerHtml, /id="strategySourceStatus"[^>]+aria-label="Strategy source: Heuristic fallback"/);
  assert.doesNotMatch(headerHtml, /connectApiBtn|<button[^>]+strategySourceStatus/);
  assert.match(railHtml, /data-tooltip="Audio"/);
  assert.match(railHtml, /data-tooltip="Settings"/);
});

test('collapsed utility access and mobile navigation remain structural', () => {
  assert.match(uiQaCss, /\.is-sidebar-collapsed \.rail-language select[^{]*\{[^}]*opacity:\s*0/);
  assert.match(uiQaCss, /@media \(max-width: 820px\)[\s\S]*?\.mode-navigation\s*\{\s*grid-template-columns:\s*repeat\(4/);
  assert.match(uiQaCss, /@media \(max-width: 820px\)[\s\S]*?\.rail-utilities[\s\S]*?grid-template-columns:\s*repeat\(3/);
  assert.doesNotMatch(uiQaCss, /@media \(max-width: (?:820|700|520)px\)[\s\S]*?\.mode-navigation\s*\{[^}]*display:\s*none/);
});

test('language selector presents flags with full accessible names', () => {
  assert.match(railHtml, /🇺🇸 English/);
  assert.match(railHtml, /🇷🇺 Русский/);
  assert.match(railHtml, /🇮🇱 עברית/);
  assert.match(railHtml, /select id="langToggle"[^>]+aria-label="Language"/);
  assert.match(logic, /localStorage\.getItem\('language'\)/);
});

test('responsive strategy is fluid rather than resolution-specific', () => {
  assert.match(uiQaCss, /minmax\(/);
  assert.match(uiQaCss, /clamp\(/);
  assert.match(uiQaCss, /max-width:\s*1840px/);
  for (const breakpoint of [1500, 1320, 1280, 1180, 1100, 900, 820, 700, 520]) {
    assert.match(uiQaCss, new RegExp(`(?:min|max)-width: ${breakpoint}px`), String(breakpoint));
  }
  assert.doesNotMatch(uiQaCss, /2200px|1920px|1536px|1440px|1024px|768px|390px/);
});

test('Playbook workflow and betting context use compact structural strips', () => {
  assert.match(playbookHtml, /class="playbook-state-source"/);
  assert.match(playbookHtml, /class="playbook-context-primary"/);
  assert.match(playbookHtml, /class="fields playbook-context-sliders"/);
  assert.match(uiQaCss, /#playbookModeControl \.ui-tab\s*\{[^}]*min-height:\s*42px/);
  assert.match(uiQaCss, /\.playbook-context-primary\s*\{[^}]*grid-template-columns:/);
});

test('Playbook table collapse releases its entire layout region', () => {
  assert.match(playbookHtml, /id="toggleTableBtn"[^>]+aria-expanded="true"[^>]+aria-controls="table-wrapper"/);
  assert.match(playbookHtml, /id="table-wrapper"[^>]+data-collapsible-region="poker-table"/);
  assert.match(logic, /e\.currentTarget\.setAttribute\('aria-expanded', String\(!collapsed\)\)/);
  assert.match(uiQaCss, /\.table-wrapper\.collapsed\s*\{[^}]*height:\s*0[^}]*min-height:\s*0[^}]*max-height:\s*0/);
});

test('Action Path is sticky on wide desktop and returns to normal flow below it', () => {
  assert.match(playbookHtml, /id="playbookDecisionPathPanel"/);
  assert.match(uiQaCss, /@media \(min-width: 1500px\)[\s\S]*?\.playbook-support-rail\s*\{[^}]*position:\s*sticky/);
  assert.match(uiQaCss, /@media \(min-width: 901px\) and \(max-width: 1499px\)[\s\S]*?\.playbook-support-rail\s*\{[^}]*position:\s*static/);
});

test('Equity board is an explicit horizontal Holdem flow', () => {
  assert.match(equityHtml, /class="cards-row equity-board-cards"/);
  assert.match(equityHtml, /equity-street-flop">Flop[\s\S]*Turn[\s\S]*River/);
  assert.match(uiQaCss, /\.equity-board-cards\s*\{[^}]*flex-direction:\s*row[^}]*flex-wrap:\s*nowrap[^}]*direction:\s*ltr/);
  assert.match(uiQaCss, /overflow-x:\s*auto/);
});

test('Equity communicates arbitrary 2 through 10 counts with a stepper and optional presets', () => {
  assert.match(equityHtml, /aria-label="Player count, from 2 through 10"/);
  assert.match(equityHtml, /data-equity-player-delta="-1"/);
  assert.match(equityHtml, /data-equity-player-delta="1"/);
  assert.match(equityHtml, /aria-label="Quick player count presets"/);
  assert.match(logic, /Math\.max\(2, Math\.min\(10/);
  assert.match(logic, /playerCount\.textContent = `\$\{app\.equity\.players\.length\} players`/);
});

test('Equity keeps calculation in the primary input workflow and coexists with results on desktop', () => {
  assert.match(equityHtml, /class="equity-input-stack"[\s\S]*id="calculate"/);
  assert.match(uiQaCss, /@media \(min-width: 1280px\)[\s\S]*?\.equity-input-stack\s*\{[^}]*grid-template-columns:\s*repeat\(2/);
  assert.match(equityHtml, /class="equity-shared-flow"[\s\S]*class="panel equity-cards-panel"[\s\S]*class="panel equity-controls-panel"/);
  assert.match(uiQaCss, /\.equity-shared-flow \.equity-controls-panel\s*\{\s*border-top:/);
  assert.match(uiQaCss, /\.equity-workspace\s*\{[^}]*grid-template-columns:/);
  assert.match(uiQaCss, /@media \(max-width: 900px\)[\s\S]*?\.equity-workspace\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
});

test('Training centers the decision between support and setup on wide desktop', () => {
  assert.match(trainingHtml, /class="training-decision-column"/);
  assert.match(trainingHtml, /class="training-insight-column"/);
  assert.match(trainingHtml, /class="training-setup-column"/);
  assert.match(uiQaCss, /@media \(min-width: 1320px\)[\s\S]*?grid-template-areas:\s*"insight decision setup"/);
  assert.match(uiQaCss, /@media \(max-width: 900px\)[\s\S]*?\.training-decision-column\s*\{[^}]*order:\s*1/);
  assert.match(uiQaCss, /\.training-action-button:hover/);
});

test('Settings expose clearer switches, aligned solver icon, and persisted T versus 10 preference', () => {
  assert.match(html, /id="cardRankStyleControl"/);
  assert.match(html, /data-card-rank-style="poker"/);
  assert.match(html, /data-card-rank-style="full-ten"/);
  assert.match(logic, /riverline_card_rank_style/);
  assert.match(logic, /document\.documentElement\.dataset\.cardRankStyle = nextStyle/);
  assert.match(uiQaCss, /\.ui-switch b,[\s\S]*?background:\s*var\(--text-secondary\)/);
  assert.match(uiQaCss, /\.solver-import-btn \.button-icon\s*\{[^}]*width:\s*18px[^}]*display:\s*block/);
  assert.match(sound, /settingsBtn\.setAttribute\('aria-pressed', String\(soundEnabled\)\)/);
});

test('full-ten preference changes presentation but preserves canonical card identities', () => {
  assert.match(logic, /displayCardRank = \(rank\) => rank === 'T'/);
  assert.match(logic, /const card = rank \+ suit\.id/);
  assert.match(logic, /data-deck-card="\$\{card\}"/);
  assert.match(table, /const visualRank = rank === 'T'/);
  assert.doesNotMatch(logic.match(/function applyCardRankStyle[\s\S]*?\n\}/)?.[0] ?? '', /RANKS\s*=|RANK_VALUE|heroCards\s*=|board\s*=/);
});

test('broken free-form layout editor is no longer presented or bootstrapped', () => {
  assert.doesNotMatch(html, /id="lockUiBtn"/);
  assert.doesNotMatch(html, /src="src\/ui\/dragAndDrop\.js"/);
  assert.doesNotMatch(html, /data-layout-fixed/);
  assert.doesNotMatch(railHtml, />Layout</);
});

test('stabilization uses semantic stepped surfaces and softened Daylight tokens', () => {
  assert.match(uiQaCss, /background:\s*var\(--surface-section\)/);
  assert.doesNotMatch(uiQaCss, /background(?:-color)?:\s*(?:#000(?:000)?|rgb\(0\s*,\s*0\s*,\s*0\))/i);
  const daylight = css.match(/\[data-theme="daylight"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(daylight, /--surface-canvas:\s*#e8e2d8/);
  assert.match(daylight, /--surface-panel:\s*#f1ede5/);
  assert.doesNotMatch(daylight, /--surface-(?:canvas|shell|panel|elevated|interactive|inset):\s*#fff(?:fff)?\b/i);
});

test('RTL, reduced motion, and interaction-versus-state affordances remain explicit', () => {
  assert.match(uiQaCss, /\[dir="rtl"\] \.equity-board-cards/);
  assert.match(uiQaCss, /\[dir="rtl"\] \.rail-collapse-icon/);
  assert.match(uiQaCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /data-state-surface="derived"/);
  assert.match(html, /data-interaction-surface="interactive"/);
  assert.match(uiQaCss, /\[data-state-surface="derived"\]\s*\{[^}]*cursor:\s*default/);
});

test('UI-QA-001 presentation section contains no poker, strategy, Equity-math, Training-generation, or solver code', () => {
  assert.doesNotMatch(uiQaCss, /DecisionContext|StrategyResult|PokerState|calculateEquity|evaluateSeven|MCCFR|regret|TrainingConfig/);
  for (const symbol of ['deriveDecisionContext', 'calculateEquity']) {
    assert.match(logic, new RegExp(symbol));
  }
  assert.match(strategy, /calculatePreflopFallbackStrategy/);
  assert.match(strategy, /calculatePostflopHeuristicStrategy/);
});
