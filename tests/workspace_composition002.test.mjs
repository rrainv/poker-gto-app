import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_PRESENTATION_LAYOUT,
  PRESENTATION_LAYOUT_STORAGE_KEY,
  WORKSPACE_LAYOUT_DEFINITIONS,
  getWorkspaceLayoutPresets,
  resolveWorkspaceLayoutPreset,
} from '../app/src/application/presentation-layout.mjs';
import { PRESENTATION_DENSITY_STORAGE_KEY } from '../app/src/application/presentation-density.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const layoutSource = fs.readFileSync(new URL('../app/src/application/presentation-layout.mjs', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const translations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');
const ticketCss = css.slice(
  css.indexOf('WORKSPACE-COMPOSITION-002'),
  css.indexOf('WELCOME-INTRO-001'),
);

test('WORKSPACE-COMPOSITION-002 exposes only audited presets and repairs stale choices', () => {
  assert.equal(DEFAULT_PRESENTATION_LAYOUT, 'balanced');
  assert.deepEqual(getWorkspaceLayoutPresets('hand'), ['balanced', 'table-focus']);
  assert.deepEqual(getWorkspaceLayoutPresets('analyze'), ['balanced', 'analysis-focus']);
  assert.deepEqual(getWorkspaceLayoutPresets('training'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('personal-strategy'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('equity'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('home'), ['balanced']);
  assert.deepEqual(getWorkspaceLayoutPresets('saved'), ['balanced']);
  assert.equal(resolveWorkspaceLayoutPreset('table-focus', 'training'), 'balanced');
  assert.equal(resolveWorkspaceLayoutPreset('controls-first', 'hand'), 'balanced');
  assert.equal(resolveWorkspaceLayoutPreset('analysis-focus', 'equity'), 'balanced');
  assert.equal(resolveWorkspaceLayoutPreset('controls-first', 'equity'), 'balanced');
  assert.equal(PRESENTATION_LAYOUT_STORAGE_KEY, 'riverline_presentation_layout');
  assert.equal(PRESENTATION_DENSITY_STORAGE_KEY, 'riverline_presentation_density');
  assert.doesNotMatch(layoutSource, /schemaVersion|layout[_-]v2/i);
  assert.doesNotMatch(`${layoutSource}\n${ticketCss}`, /dragstart|draggable|contenteditable|gridstack|interact\.js/i);
});

test('every surviving preset has a distinct job and removed choices are unavailable', () => {
  for (const definitions of Object.values(WORKSPACE_LAYOUT_DEFINITIONS)) {
    assert.equal(new Set(definitions.map(({ job }) => job)).size, definitions.length);
    assert.ok(definitions.every(({ job }) => job.length >= 40));
  }
  assert.doesNotMatch(layoutSource, /controls-first/);
  assert.doesNotMatch(html, /data-layout-preset-option="controls-first"/);
  assert.doesNotMatch(html, /id="densityControl"|data-density-option=/);
  assert.match(ticketCss, /data-product-destination="hand"[^}]*:not\(\s*\[data-hand-stage="setup"\]\s*\):not\(\[data-hand-stage="replay"\]\)[^}]*#handStageDock:not\(\[hidden\]\)\s*\{[^}]*order:\s*2/s);

  const balancedReserve = Number(css.match(/#visual-table-container\s*\{\s*--play-stage-reserve:\s*(\d+)px/)?.[1]);
  const tableFocusReserve = Number(css.match(/data-layout-preset="table-focus"[^}]*#visual-table-container[\s\S]*?--play-stage-reserve:\s*(\d+)px/)?.[1]);
  assert.equal(balancedReserve, 455);
  assert.equal(tableFocusReserve, 350);
  assert.ok(tableFocusReserve < balancedReserve, 'Table Focus has a materially larger vertical table target');
  assert.match(css, /data-layout-preset="analysis-focus"[^}]*data-product-destination="analyze"[^}]*\.playbook-workspace\s*\{[^}]*minmax\(0, 1fr\) minmax\(245px, 280px\)/s);
  assert.match(css, /data-layout-preset="analysis-focus"[^}]*data-product-destination="analyze"[^}]*#table-wrapper\s*\{[^}]*padding:\s*var\(--space-4\)[^}]*border:/s);
  assert.match(css, /data-layout-preset="analysis-focus"[^}]*data-product-destination="analyze"[^}]*#visual-table-container\s*\{[^}]*980px[^}]*margin-inline-start:\s*0/s);
});

test('Compact changes coherent tokens while protecting decision and card readability floors', () => {
  assert.match(ticketCss, /\[data-density="compact"\]\s*\{[^}]*--control-height:\s*38px[^}]*--density-panel-inline:\s*14px/s);
  assert.match(ticketCss, /data-context-priority="headline"[^}]*> strong\s*\{[^}]*font-size:\s*max\(\.875rem, var\(--text-body-size\)\)/s);
  assert.match(css, /@media \(min-width: 1320px\)[\s\S]*?\.training-action-button\s*\{[^}]*min-height:\s*60px/s);
  assert.match(css, /\.riverline-card\[data-card-size="picker"\][^}]*--card-corner-rank-size:\s*14px[^}]*--card-corner-suit-size:\s*13px/s);
  assert.doesNotMatch(ticketCss, /font-size:\s*(?:[0-9]|1[01])px/);
});

test('Training context is one semantic hierarchy driven by existing lifecycle state', () => {
  const context = html.slice(html.indexOf('id="trainingPotInfo"'), html.indexOf('id="trainingAssistance"'));
  const expectedOrder = [
    'trainingFacingVal',
    'trainingPositionVal',
    'trainingStackVal',
    'trainingPotVal',
    'trainingTableVal',
    'trainingStreetLabel',
  ];
  assert.match(context, /role="group"[^>]*aria-label="Decision context"[^>]*data-i18n-aria-label="Decision context"/);
  assert.ok(expectedOrder.every((id, index) => index === 0 || context.indexOf(id) > context.indexOf(expectedOrder[index - 1])));
  assert.equal((context.match(/data-context-priority="headline"/g) || []).length, 1);
  assert.equal((context.match(/data-context-priority="primary"/g) || []).length, 3);
  assert.equal((context.match(/data-context-priority="secondary"/g) || []).length, 2);
  assert.match(ticketCss, /training-context-fact--headline\s*\{[^}]*grid-column:\s*span 2/s);
  assert.match(ticketCss, /training-full-hand-phase="off"\]\s*\{[^}]*grid-template-columns:\s*repeat\(12, minmax\(0, 1fr\)\)/s);
  assert.match(ticketCss, /training-full-hand-phase="off"[^}]*> :is\(\.training-insight-column, \.training-setup-column\)\s*\{[^}]*display:\s*contents/s);
  assert.match(ticketCss, /data-training-state="idle"[^}]*\.training-state-message\s*\{[^}]*min-block-size:\s*128px/s);
  assert.match(ticketCss, /#trainingHistoryPanel\s*\{[^}]*grid-column:\s*1 \/ span 4[^}]*grid-row:\s*3/s);
  assert.match(ticketCss, /#trainingSetupPanel\s*\{[^}]*grid-column:\s*9 \/ -1[^}]*grid-row:\s*1/s);
  assert.match(ticketCss, /\.training-session-panel\s*\{[^}]*grid-column:\s*9 \/ -1[^}]*grid-row:\s*2/s);
  assert.match(ticketCss, /\.training-session-panel \.training-stat-grid\s*\{[^}]*repeat\(5,/s);
  assert.match(html, /<details class="panel training-assistance-panel"[^>]*><summary/);
  assert.match(ticketCss, /data-training-state="feedback"[^}]*#trainingSolution\s*\{[^}]*grid-column:\s*9 \/ -1/s);
  assert.doesNotMatch(css, /data-layout-preset="(?:table-focus|controls-first)"[^}]*\.training-workspace/s);
});

test('Equity keeps a stable gallery, center Board, and global Hand Analysis rail', () => {
  const equity = html.slice(html.indexOf('class="equity-workspace"'), html.indexOf('<!-- Settings Modal -->'));
  assert.match(equity, /class="equity-workspace" data-equity-state="empty"/);
  assert.ok(equity.indexOf('equity-player-panel') < equity.indexOf('equity-center-column'));
  assert.ok(equity.indexOf('equity-center-column') < equity.indexOf('equity-dossier-panel'));
  assert.match(logic, /function setEquityCompositionState\(state\)[\s\S]*?new Set\(\['empty', 'stale', 'running', 'complete', 'error'\]\)[\s\S]*?workspace\.dataset\.equityState = resolved/);
  assert.match(ticketCss, /\.equity-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(360px, 400px\) minmax\(400px, 448px\) minmax\(520px, 1fr\)/s);
  assert.match(ticketCss, /#equityMode \.workspace-frame--standard\s*\{[^}]*--workspace-frame-max:\s*var\(--workspace-frame-dense\)/s);
  assert.match(ticketCss, /\.equity-center-column\s*\{[^}]*display:\s*grid/s);
  assert.match(ticketCss, /\.equity-dossier-panel\s*\{[^}]*position:\s*sticky/s);
  assert.doesNotMatch(ticketCss, /data-equity-state="(?:running|complete)"\][^{]*\.equity-workspace\s*\{[^}]*grid-template-columns/s);
  assert.doesNotMatch(css, /data-layout-preset="analysis-focus"[^}]*\.equity-workspace/s);
  assert.match(ticketCss, /\.equity-player-list\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)[^}]*max-block-size:\s*654px[^}]*overflow-y:\s*auto[^}]*overflow-x:\s*hidden/s);
  assert.match(ticketCss, /data-density="compact"[^}]*\.equity-player-list\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(logic, /function equityPlayerResultMarkup\(player, playerIndex\)[\s\S]*?data-result-state="\$\{state\}"[\s\S]*?equity-result-primary[\s\S]*?t\('Win'\)[\s\S]*?t\('Tie'\)/s);
  assert.match(logic, /function renderEquityPlayerResults\(\)[\s\S]*?footer\.outerHTML = equityPlayerResultMarkup\(player, playerIndex\)[\s\S]*?renderEquityComparison\(\)/s);
  assert.match(logic, /function renderEquityResult\([\s\S]*?renderEquityPlayerResults\(\)[\s\S]*?renderEquityHandAnalysis\(\)/s);
  assert.match(logic, /class="equity-player-footer"/);
  assert.match(equity, /id="equityHandAnalysisTitle"[^>]*>Hand Analysis/);
  assert.doesNotMatch(logic, /selectedPlayerId|selectEquityPlayer/);
  assert.doesNotMatch(logic.slice(logic.indexOf('function renderEquityPlayers'), logic.indexOf('function updateActionOptions')), /outsPanel-|equity-result-tile/);
  assert.match(logic, /app\.equity\.lifecycle === 'running'/);
  assert.match(logic, /app\.equity\.lifecycle === 'complete'/);
  assert.doesNotMatch(equity, /id="equityBars"|class="equity-result-card"|equity-output-stack/);
  assert.doesNotMatch(css, /data-layout-preset="controls-first"[^}]*\.equity-workspace/s);
});

test('responsive, RTL, localization, board, and card contracts remain explicit', () => {
  assert.match(ticketCss, /@media \(max-width: 1100px\)[\s\S]*?\.equity-workspace[\s\S]*?flex-direction:\s*column/);
  assert.match(ticketCss, /@media \(max-width: 620px\)[\s\S]*?\.training-context-strip\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.doesNotMatch(ticketCss, /margin-left|margin-right|padding-left|padding-right|\bleft\s*:|\bright\s*:|(?<!-)direction\s*:/);
  assert.match(css, /\[dir="rtl"\] \.playbook-board-layout \{ direction: ltr; unicode-bidi: isolate; \}/);
  assert.match(css, /\.playbook-board-layout\s*\{[^}]*grid-template-columns:\s*repeat\(5, var\(--poker-card-width\)\)/s);
  assert.match(css, /\.table-card-corner-rank\s*\{[^}]*15px/);
  assert.match(css, /\.table-card-corner-suit\s*\{[^}]*14px/);
  assert.match(css, /\.table-card-center-suit\s*\{[^}]*24px/);
  assert.match(css, /card--style-classic \.table-card-center\s*\{[^}]*display:\s*block/s);
  assert.match(css, /table-card-back-face[\s\S]*?table-card-back-inner/);
  assert.ok((translations.match(/"Decision context"/g) || []).length >= 2, 'RU and HE register the new semantic label');
  assert.match(translations, /"Changes emphasis and composition only\. Density, poker state, and available tools stay the same\."/);
});

test('composition is CSS/state-event driven and preserves existing DOM semantics', () => {
  assert.match(css, /\.hand-review-surface\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  assert.doesNotMatch(logic, /ResizeObserver|setInterval\([^)]*layout|requestAnimationFrame\([^)]*layout/i);
  assert.match(html, /id="trainingWorkspace"[^>]*aria-labelledby="trainingWorkspaceTitle"/);
  assert.match(html, /id="trainingGuessButtons"[^>]*aria-label="Available actions"/);
  assert.match(html, /class="equity-player-count-control" role="group"/);
  assert.ok(html.indexOf('class="training-decision-column"') < html.indexOf('class="training-insight-column"'));
  assert.ok(html.indexOf('class="training-insight-column"') < html.indexOf('class="training-setup-column"'));
});
