import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  ANALYZE_VERDICT_SCHEMA_VERSION,
  VERDICT_CLOSE_MARGIN,
  VERDICT_MEANINGFUL_SHARE,
  describeAnalyzeVerdict,
} from '../app/src/application/analyze-verdict.mjs';
import {
  DECISION_FACING_KINDS,
  describeDecisionFacing,
  formatDecisionFacing,
} from '../app/src/application/decision-facing-summary.mjs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../app/index.html');
const css = read('../app/styles.css');
const logic = read('../app/src/core/logic.js');
const translations = read('../app/src/locales/product-translations.js');
const verdictModule = read('../app/src/application/analyze-verdict.mjs');

const sectionStart = css.indexOf('/* ANALYZE-COMPOSITION-001: Analyze composition');
assert.ok(sectionStart > 0, 'Analyze composition CSS section must exist');
const analyzeCss = css.slice(sectionStart);
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n', css.indexOf(':root {')));
const decision = html.slice(html.indexOf('id="recommendation"'), html.indexOf('id="handLiveStageHeader"'));
const rail = html.slice(html.indexOf('id="playbookSpotPanel"'), html.indexOf('id="playbookHandWorkspace"'));

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice ${start} -> ${end}`);
  return source.slice(from, to);
}

const result = (rows) => ({
  schemaVersion: 'strategy-result/v1',
  recommendation: { label: rows[0][0].toUpperCase(), action: { type: rows[0][1] } },
  actions: rows.map(([label, type, probability]) => ({ label, probability, action: { type, amountBb: null, potFraction: null } })),
});

// ---------------------------------------------------------------------------
// Verdict dominance and sentence case
// ---------------------------------------------------------------------------

test('verdict dominance: a 20-point lead (or no meaningful alternative) is dominant', () => {
  assert.equal(VERDICT_CLOSE_MARGIN, 0.2);
  assert.equal(VERDICT_MEANINGFUL_SHARE, 0.05);
  const dominant = describeAnalyzeVerdict(result([['3-Bet', 'raise', 0.7], ['Call', 'call', 0.2], ['Fold', 'fold', 0.1]]));
  assert.equal(dominant.schemaVersion, ANALYZE_VERDICT_SCHEMA_VERSION);
  assert.equal(dominant.kind, 'dominant');
  assert.equal(dominant.primary.label, '3-Bet', 'sentence-case action label, not the upper-case recommendation label');
  assert.equal(dominant.secondary, null);
  // Exactly the margin is dominant; floating noise never flips the class.
  assert.equal(describeAnalyzeVerdict(result([['Open', 'raise', 0.6], ['Fold', 'fold', 0.4]])).kind, 'dominant');
  assert.equal(describeAnalyzeVerdict(result([['Open', 'raise', 0.1 + 0.5], ['Fold', 'fold', 0.4]])).kind, 'dominant');
  // A second action under 5% never makes a spot "close".
  assert.equal(describeAnalyzeVerdict(result([['Fold', 'fold', 0.52], ['Call', 'call', 0.04]])).kind, 'dominant');
  assert.equal(describeAnalyzeVerdict(result([['Check', 'check', 1]])).kind, 'dominant');
});

test('verdict dominance: two actions within 20 points read as a close mix', () => {
  const close = describeAnalyzeVerdict(result([['3-Bet', 'raise', 0.50125], ['Call', 'call', 0.399375], ['Fold', 'fold', 0.099375]]));
  assert.equal(close.kind, 'close');
  assert.equal(close.primary.label, '3-Bet');
  assert.equal(close.secondary.label, 'Call');
  assert.equal(close.marginPoints, 10);
  // Order comes from probability; the provider's order only breaks ties.
  const reordered = describeAnalyzeVerdict(result([['Call', 'call', 0.45], ['Raise', 'raise', 0.55]]));
  assert.equal(reordered.primary.label, 'Raise');
  const tie = describeAnalyzeVerdict(result([['Check', 'check', 0.5], ['Bet', 'bet', 0.5]]));
  assert.equal(tie.kind, 'close');
  assert.equal(tie.primary.label, 'Check');
  assert.equal(describeAnalyzeVerdict(result([['Open', 'raise', 0.59], ['Fold', 'fold', 0.41]])).kind, 'close');
});

test('verdict dominance reads existing StrategyResult data only and never changes it', () => {
  const input = result([['Call', 'call', 0.55], ['Raise', 'raise', 0.45]]);
  const snapshot = JSON.stringify(input);
  describeAnalyzeVerdict(input);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(describeAnalyzeVerdict(null).kind, 'unavailable');
  assert.equal(describeAnalyzeVerdict({ actions: [] }).kind, 'unavailable');
  assert.doesNotMatch(verdictModule, /strategyProvider|resolve\(|import /, 'no strategy authority or dependency');
  const moduleAt = html.indexOf('<script type="module" src="src/application/analyze-verdict.mjs"></script>');
  assert.ok(moduleAt > 0 && moduleAt < html.indexOf('<script src="src/core/logic.js'), 'the module registers before logic.js runs');
});

test('the verdict renders in sentence case, primary color, display size; close mixes are smaller and say so', () => {
  const render = sourceBetween(logic, 'function renderAnalyzeVerdict(strategyResult)', '// Technical source id/version');
  assert.match(render, /window\.RiverlineAnalyzeVerdict\?\.describe\(strategyResult\)/);
  assert.match(render, /t\('\{first\} or \{second\}'/);
  assert.match(render, /t\('Close mix · \{first\} \{firstShare\} · \{second\} \{secondShare\}'/);
  assert.match(render, /element\.textContent = t\(verdict\.primary\.label\)/);
  assert.match(render, /strategyResultPresentationActions\(strategyResult\)/, 'close shares match the mix card');
  assert.doesNotMatch(logic, /\$\('#bestAction'\)\)? ?\$\('#bestAction'\)\.textContent = t\(profile\.best\)/);
  assert.doesNotMatch(logic, /bestAction\.textContent = t\(profile\.best\)/);
  assert.match(decision, /id="bestAction" data-verdict-kind="dominant"/);
  assert.match(decision, /id="bestActionClose" hidden/);
  assert.match(analyzeCss, /#bestAction \{[^}]*color: var\(--text-primary\);[^}]*font: var\(--weight-display\) var\(--t-display\)\/var\(--t-display-line\)[^}]*text-transform: none;/s);
  assert.match(analyzeCss, /#bestAction\[data-verdict-kind="close"\] \{[^}]*font-size: var\(--t-verdict-close\)/s);
  assert.match(rootBlock, /--t-verdict-close: 1\.75rem;/);
  assert.doesNotMatch(decision, /id="streetLabel"[^>]*text-transform/, 'the street eyebrow is sentence case');
  for (const key of ['{first} or {second}', 'Close mix · {first} {firstShare} · {second} {secondShare}']) {
    assert.ok(translations.includes(`['${key}',`), `${key} has RU/HE drafts`);
  }
});

// ---------------------------------------------------------------------------
// Source badge once; status line and provenance
// ---------------------------------------------------------------------------

test('the source badge appears once: the body repeats a source only when it differs (reference)', () => {
  assert.equal((html.match(/data-variant="source"/g) || []).length, 1, 'one header source badge');
  assert.match(decision, /id="sourceBadge" hidden/);
  const updateContext = sourceBetween(logic, 'async function updateContext(reason', 'let equityCalculationGeneration');
  assert.match(updateContext, /sourceBadge\.hidden = !isReference;/);
  const refresh = sourceBetween(logic, 'function refreshLocalizedPlaybookRuntime()', 'if (playbookSurfaceIsVisible(\'matrix\'))');
  assert.match(refresh, /\$\('#sourceBadge'\)\.hidden = !isReference;/);
  assert.match(sourceBetween(logic, 'function renderUnavailableStrategy(resolution)', 'function '), /\$\('#sourceBadge'\)\.hidden = true;/);
  assert.match(analyzeCss, /#sourceBadge\[hidden\] \{ display: none; \}/);
});

test('no status line above the workspace; the authority meaning stays live and in Provenance', () => {
  assert.match(html, /<p id="playbookModeStatus" class="playbook-mode-status" role="status" aria-live="polite"/);
  assert.match(analyzeCss, /#playbookModeStatus \{[^}]*position: absolute;[^}]*clip: rect\(0 0 0 0\);/s, 'visually hidden in Analyze only (Hand keeps it)');
  const status = sourceBetween(logic, 'function renderPlaybookModeStatus(resolution)', '// ANALYZE-COMPOSITION-001: verdict dominance');
  assert.match(status, /\$\('#playbookModeProvenance'\)/);
  assert.match(decision, /<details id="analysisProvenanceDisclosure" class="ui-disclosure analyze-provenance">[\s\S]*id="playbookModeProvenance"[\s\S]*id="strategyMeta"/);
  const meta = sourceBetween(logic, 'function renderStrategyMeta(claimPolicy)', '// Collapsed rail disclosures');
  assert.match(meta, /version\.className = 'technical-id';/, 'monospace only for the technical source id inside Provenance');
  assert.match(analyzeCss, /#strategyMeta \.technical-id \{[^}]*font-family: var\(--font-mono\)/s);
  assert.doesNotMatch(logic, /analysisProvenanceDisclosure'\)\.innerHTML|analysisProvenanceDisclosure.*replaceChildren/, 'static disclosure keeps its open state across language switches');
});

// ---------------------------------------------------------------------------
// Structure: two containers, tabs, stepper
// ---------------------------------------------------------------------------

test('Analyze has exactly two containers: one Spot rail panel and one Result panel', () => {
  assert.match(analyzeCss, /\.playbook-workspace \{[^}]*grid-template-columns: var\(--analyze-rail-width\) minmax\(0, 1fr\);/s);
  assert.match(analyzeCss, /\.playbook-spot-panel \{[^}]*border: 1px solid var\(--border-default\);[^}]*border-radius: var\(--radius-panel\);/s);
  assert.match(analyzeCss, /\.playbook-decision-workspace \{[^}]*border: 1px solid var\(--border-default\);[^}]*border-radius: var\(--radius-panel\);/s);
  assert.match(analyzeCss, /\.playbook-support-rail \{ display: none; \}/);
  for (const inner of ['#recommendation', ':is\\(\\.range-matrix-panel, \\.range-comparison-panel\\)', '#playbookDecisionPathPanel']) {
    assert.match(analyzeCss, new RegExp(`${inner} \\{[^}]*background: none;[^}]*border: 0;`, 's'), `${inner} is a section, not a box`);
  }
  assert.equal((rail.match(/class="panel /g) || []).length, 1, 'the Spot rail is one panel');
  for (const id of ['scenarioCardsPanel', 'sharedControls', 'scenarioConfigurationPanel', 'analyzeHandContext']) {
    assert.match(rail, new RegExp(`id="${id}" class="playbook-spot-section`), `${id} is a rail section`);
  }
  assert.match(rail, /id="playbookStrategyAdjustment" class="ui-disclosure playbook-spot-disclosure"/);
  assert.match(rail, /id="playbookGameAccounting" class="ui-disclosure playbook-spot-disclosure"/);
});

test('the Spot rail keeps every control, the readiness/numeric-entry ids and order Cards > Action > Table', () => {
  const order = ['data-slots="hero"', 'data-slots="board"', 'data-slots="dead"', 'id="heroPos"', 'id="lastAction"', 'id="facingSizeNum"', 'id="potSizeNum"', 'id="playersNum"', 'id="stackMode"', 'id="stackNum"', 'id="tightnessSlider"', 'id="oppTightnessSlider"', 'id="rakeMode"', 'id="toggleAdvanced"', 'id="anteNum"', 'id="straddle"'];
  let last = -1;
  for (const marker of order) {
    const at = rail.indexOf(marker);
    assert.ok(at > last, `${marker} in order`);
    last = at;
  }
  assert.match(rail, /class="playbook-spot-head playbook-randomize-head"[\s\S]*id="scenarioRandomizeButton"/, 'randomize is a quiet rail-header control');
  assert.doesNotMatch(html, /id="sharedControls" class="playbook-betting-context"/, 'the center Betting context strip is gone');
});

test('Result header: view tabs on the start side, Save spot (secondary) and View all hands (quiet) on the end', () => {
  const nav = html.slice(html.indexOf('<nav id="playbookAnalysisNavigation"'), html.indexOf('</nav>', html.indexOf('<nav id="playbookAnalysisNavigation"')));
  assert.match(nav, /id="playbookAnalysisTabs" class="sub-tabs ui-tabs" role="tablist"[\s\S]*class="playbook-result-actions"[\s\S]*id="savedStudySaveButton" class="ui-button ui-button--secondary[\s\S]*id="openCharts"/);
  assert.match(nav, /class="ui-button playbook-view-all-hands" data-variant="quiet"/);
  assert.match(analyzeCss, /#playbookAnalysisTabs \.ui-tab:is\(\.active, \[aria-selected="true"\]\) \{[^}]*border-block-end-color: var\(--accent-primary\);/s);
  assert.match(analyzeCss, /\.playbook-result-actions \{[^}]*order: 2;[^}]*margin-inline-start: auto;/s);
});

test('the street stepper replaces the Action path rail at every width', () => {
  const init = sourceBetween(logic, 'function initActionPathPresentation()', 'function renderUnavailableActionPath');
  assert.match(init, /applyActionPathPresentation\(true\)/);
  assert.doesNotMatch(init, /matchMedia/);
  assert.match(analyzeCss, /#playbookCompactActionPathMount \{[^}]*order: 2;/s);
  assert.match(analyzeCss, /#playbookDecisionPathPanel \.path-progress \{[^}]*flex-direction: row;/s);
  assert.match(analyzeCss, /#playbookDecisionPathPanel \.path-step\.active \.path-node \{[^}]*background: var\(--accent-primary\);/s, 'the active step carries the accent');
});

test('the Spot table is a collapsed section of the Result panel; Hand keeps its table open', () => {
  assert.match(logic, /const playbookTableExpandedByDestination = \{ hand: true, analyze: false \};/);
  assert.match(sourceBetween(logic, 'function applyPlaybookDestinationPresentation(', 'function syncPlaybookNavigationDestination('), /setCanonicalTableExpanded\(tableExpanded\)/);
  assert.match(analyzeCss, /\.playbook-table-toggle \{[^}]*order: 4;/s);
});

// ---------------------------------------------------------------------------
// Fact grid wording and non-truncation
// ---------------------------------------------------------------------------

function factFunctions() {
  const source = sourceBetween(logic, '// Facing reads the canonical facing class', 'function updateMetrics()');
  const context = {
    window: { RiverlineDecisionFacing: { kinds: DECISION_FACING_KINDS, describe: describeDecisionFacing, format: formatDecisionFacing } },
    t: (key, values = {}) => ({ 'facing.price.unavailable': 'price unavailable' }[key] || String(key).replace(/\{(\w+)\}/g, (m, k) => values[k] ?? m)),
  };
  vm.createContext(context);
  vm.runInContext(`${source}; this.facing = analyzeFacingFact; this.toCall = analyzeToCallFact;`, context);
  return context;
}

test('fact grid: facing and to-call wording follows DECISION_CONTEXT_SPEC §10 without inventing a price', () => {
  const { facing, toCall } = factFunctions();
  const ctx = (summary, extra = {}) => ({ street: 'preflop', priorActionSummary: summary, facingSizeBb: 3, callAmountBb: null, heroStackBb: 100, ...extra });
  assert.equal(facing(ctx({ aggressionCount: 1, facingActionFamily: 'raise' }), 3), '3.0 bb');
  assert.equal(facing(ctx({ aggressionCount: 0, limperCount: 0 }, { callAmountBb: 1 }), 0), 'Unopened');
  assert.equal(facing(ctx({ aggressionCount: 0, limperCount: 2 }, { callAmountBb: 1 }), 0), 'Limped');
  assert.equal(facing(ctx({ aggressionCount: 0, limperCount: 0 }, { callAmountBb: 0 }), 0), 'Option');
  assert.equal(facing(ctx({ aggressionCount: 0 }, { street: 'flop', callAmountBb: 0 }), 0), 'Check available');
  assert.equal(toCall(null), '-');
  assert.equal(toCall(ctx({ aggressionCount: 1 })), 'price unavailable', 'Scenario never fabricates a price');
  assert.equal(toCall(ctx({ aggressionCount: 1 }, { callAmountBb: 6 })), '6.0 bb');
  assert.equal(toCall(ctx({ aggressionCount: 1 }, { callAmountBb: 20, heroStackBb: 20 })), '20.0 bb · All-in');
});

test('fact grid: one clean table with To call; labels muted, values 15/600 and never truncated', () => {
  const ids = ['mPosition', 'mPot', 'mFacing', 'mToCall', 'mStack', 'mEquity', 'mPotOdds', 'mSPR', 'mRake'];
  let last = -1;
  for (const id of ids) {
    const at = decision.indexOf(`id="${id}"`);
    assert.ok(at > last, `${id} in the fact grid order`);
    last = at;
  }
  assert.match(logic, /mToCall: analyzeToCallFact\(context\)/);
  assert.match(analyzeCss, /\.analyze-facts \.metric span \{[^}]*color: var\(--text-muted\);[^}]*font: var\(--weight-label\) var\(--t-label\)/s);
  assert.match(analyzeCss, /\.analyze-facts \.metric b \{[^}]*overflow: visible;[^}]*color: var\(--text-primary\);[^}]*font: var\(--weight-value\) var\(--t-value\)\/var\(--t-value-line\)[^}]*text-overflow: clip;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;[^}]*unicode-bidi: plaintext;/s);
  assert.match(rootBlock, /--t-value: 0\.9375rem;/);
  assert.match(rootBlock, /--weight-value: 650;/);
});

// ---------------------------------------------------------------------------
// Explain inline
// ---------------------------------------------------------------------------

test('Explain is inline: overline, Facts | Explain depth, three columns, Teach as a secondary action', () => {
  assert.match(decision, /class="teacher-panel analyze-explain"[\s\S]*class="analyze-overline" data-i18n="Explain"[\s\S]*id="analyzeExplainFacts"[\s\S]*id="toggleTeacher"[^>]+aria-expanded="false"[^>]+aria-controls="teacherContent"[\s\S]*id="analysisTeachDecision" class="ui-button ui-button--secondary/);
  assert.match(logic, /function syncExplainDepthControls\(\) \{[\s\S]*?aria-pressed', String\(expanded\)\)[\s\S]*?aria-pressed', String\(!expanded\)\)/);
  assert.match(analyzeCss, /#teacherContent \{[^}]*max-height: none;[^}]*overflow: visible;/s, 'no inner scrollbar');
  assert.match(analyzeCss, /#teacherContent \.analysis-explanation \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/s);
  assert.match(analyzeCss, /border-inline-start: 1px solid var\(--border-subtle\);/, 'columns separated by thin rules');
});

// ---------------------------------------------------------------------------
// Range matrix
// ---------------------------------------------------------------------------

test('Range matrix: legible shared action colors, distinct unavailable cells, hover/focus inspector', () => {
  assert.match(analyzeCss, /\.range-matrix-panel \.hand-cell\[data-mix-state="pure"\] \{ --matrix-action-tint: 52%; \}/);
  assert.match(analyzeCss, /\.range-matrix-panel \.hand-cell\[data-mix-state="mixed"\] \{ --matrix-action-tint: 34%; \}/);
  assert.match(analyzeCss, /\.range-matrix-panel \.hand-cell\[data-state="unavailable"\] \{[^}]*border-style: dashed;/s);
  assert.match(css, /\.range-matrix-panel \.hand-cell\[data-state="available"\] \{\s*background: color-mix\(in srgb, var\(--matrix-dominant-action\) var\(--matrix-action-tint\), var\(--surface-interactive\)\);/);
  for (const event of ['pointerover', 'focusin', 'focusout', 'keydown']) assert.match(logic, new RegExp(`grid\\.addEventListener\\('${event}'`));
  assert.match(logic, /grid\.addEventListener\('focusin', \(event\) => renderMatrixCellInspector\(event\.target\.closest\('\.hand-cell'\)\)\)/);
  assert.match(html, /data-matrix-state="removed"[\s\S]*Removed by known cards/);
});

// ---------------------------------------------------------------------------
// Hand context
// ---------------------------------------------------------------------------

test('Hand context: exact decision facts read-only with the existing route back; editing becomes a Scenario', () => {
  assert.match(rail, /id="analyzeHandContext" class="playbook-spot-section analyze-hand-context" hidden/);
  assert.match(rail, /id="analyzeHandContextReturn"[\s\S]*id="analyzeHandContextEdit"[^>]*aria-expanded="false"/);
  assert.match(analyzeCss, /\[data-analyze-context="hand"\]:not\(\[data-analyze-hand-editing="true"\]\) :is\(#scenarioCardsPanel, #sharedControls, #scenarioConfigurationPanel, \.playbook-spot-disclosure\) \{\s*display: none;/);
  const completed = sourceBetween(logic, 'async function openCanonicalHandDecisionInAnalysis(', 'function bindCanonicalHandWorkspace()');
  assert.match(completed, /setAnalyzeHandContext\(\{[\s\S]*returnDestination: 'hand',[\s\S]*returnLabelKey: 'Back to Hand'/);
  const fullHand = sourceBetween(logic, 'async function openFullHandDecisionInAnalysis()', 'function abortFullHandTraining()');
  assert.match(fullHand, /setAnalyzeHandContext\(\{[\s\S]*returnDestination: 'training',[\s\S]*returnLabelKey: 'Back to Training'/);
  const update = sourceBetween(logic, 'async function updateContext(reason', 'let equityCalculationGeneration');
  assert.match(update, /if \(!resolutionOverride\s*&& typeof analyzeHandContext !== 'undefined'\s*&& analyzeHandContext\) setAnalyzeHandContext\(null\);/);
  assert.match(logic, /analyzeHandContextReturn'\)\.addEventListener\('click', \(\) => \{\s*if \(analyzeHandContext\?\.returnDestination\) navigateToProductDestination\(analyzeHandContext\.returnDestination\);/);
  const renderer = sourceBetween(logic, 'function renderAnalyzeHandContext()', 'function renderCanonicalDecisionCards(');
  assert.doesNotMatch(renderer, /strategyProvider|resolve\(|calculateEquity/, 'presentation only');
  assert.match(logic, /t\(isHandMode\(\) \|\| \(typeof analyzeHandContext !== 'undefined' && analyzeHandContext\) \? 'Hand' : 'Scenario'\)/);
});

// ---------------------------------------------------------------------------
// Type scale and decoration
// ---------------------------------------------------------------------------

test('global type scale tokens are the mockup sizes', () => {
  for (const [name, value] of Object.entries({
    '--t-body': '0.875rem', '--t-small': '0.78125rem', '--t-label': '0.6875rem', '--t-heading': '0.9375rem',
    '--t-title': '1.25rem', '--t-display': '2.5rem', '--t-value': '0.9375rem',
  })) assert.match(rootBlock, new RegExp(`${name}: ${value.replace('.', '\\.')};`), name);
  assert.match(rootBlock, /--text-micro-size: var\(--t-small\);/, 'the old 11px product text rides on small');
  assert.match(rootBlock, /--t-hero: var\(--t-display\);/);
});

test('no product text below 12px except overline labels, card faces, table art and matrix glyphs', () => {
  const excluded = /hand-cell|card|deck|table-|poker-table|poker-amount|matrix|range-grid|range-cell|range-category-legend|swatch|color-previews|personal-hand-map|path-node|calibration-status-legend|dealer|chip/;
  const offenders = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const match of body.matchAll(/font(?:-size)?:[^;]*?(\d*\.?\d+)(px|rem)\b/g)) {
      const px = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
      if (px >= 12 || px < 4) continue;
      const clean = selector.replace(/\/\*[\s\S]*?\*\//g, '').trim();
      if (excluded.test(clean)) continue;
      if (/text-transform:\s*uppercase/.test(body) && px >= 11) continue;
      offenders.push(`${clean.slice(-60)} → ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, []);
  for (const [, , body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/var\(--text-micro-size\)/.test(body)) assert.doesNotMatch(body, /text-transform:\s*uppercase/, 'overlines use --t-label');
  }
});

test('no decorative borders or color in the Analyze section', () => {
  assert.doesNotMatch(analyzeCss, /border-(?:inline-start|left|top|block-start):\s*[2-9]px/);
  assert.doesNotMatch(analyzeCss, /border[^:;]*:[^;]*var\(--provenance\)/);
  assert.doesNotMatch(analyzeCss, /!important/);
  assert.doesNotMatch(decision, /style="[^"]*border/);
  assert.doesNotMatch(html.slice(html.indexOf('<section id="gtoMode"'), html.indexOf('<template id="rangeCalibrationTemplate"')), /border-left: 4px/);
  assert.doesNotMatch(rail, /id="(?:opp)?tightnessLabel" style=/, 'no decorative label colors');
  // Accent only on the active step, selection underline and slider/primary components.
  const accentLines = analyzeCss.split('\n').filter((line) => line.includes('--accent-primary'));
  // Slider thumbs use the accent hover step (slider fill is an allowed accent use).
  assert.ok(accentLines.every((line) => /border-block-end-color|box-shadow|background: var\(--accent-primary(?:-hover)?\)|border-color: var\(--accent-primary\)/.test(line)), accentLines.join('\n'));
});
