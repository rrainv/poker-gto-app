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
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const cardPresentation = fs.readFileSync(new URL('../app/src/application/card-presentation.mjs', import.meta.url), 'utf8');

const designStart = css.indexOf('DESIGN-005: poker visual system');
assert.ok(designStart >= 0, 'DESIGN-005 visual-system section must exist');
const visualSystem = css.slice(designStart);

test('playing cards share one ratio and all four stable suit classes', () => {
  assert.match(visualSystem, /--poker-card-aspect:\s*0\.701754/);
  assert.match(visualSystem, /--riverline-card-face:\s*var\(--card-face\)/);
  assert.match(visualSystem, /background:\s*var\(--riverline-card-face,\s*var\(--card-face\)\)\s*!important/);
  for (const [suit, token] of [
    ['h', 'suit-heart'], ['s', 'suit-spade'], ['d', 'suit-diamond'], ['c', 'suit-club'],
  ]) {
    assert.match(visualSystem, new RegExp(`card--suit-${suit}[\\s\\S]*?var\\(--${token}\\)`));
    assert.match(logic, new RegExp(`card--suit-\\$\\{suit\\.id\\}`));
  }
});

test('card states use explicit classes and dead or invalid states do not rely on opacity', () => {
  for (const state of ['empty', 'known', 'dead']) {
    assert.match(logic, new RegExp(`card--\\$\\{state\\}|card--${state}`));
  }
  for (const state of ['dead', 'burned', 'invalid', 'duplicate']) {
    assert.match(visualSystem, new RegExp(`card-slot\\.card--${state}`));
  }
  assert.match(visualSystem, /card--dead::after\s*\{\s*content:\s*"DEAD"/);
  assert.match(visualSystem, /card--burned::after\s*\{\s*content:\s*"BURN"/);
  assert.match(visualSystem, /card--duplicate::after\s*\{\s*content:\s*"DUP"/);
  assert.match(visualSystem, /card--dead,[\s\S]*?repeating-linear-gradient/);
});

test('unknown cards use the Riverline jade and graphite card-back treatment', () => {
  assert.match(visualSystem, /\.riverline-card-back[\s\S]*?var\(--card-back\)/);
  assert.match(visualSystem, /\.riverline-card-back\[data-card-preview-back-style="riverline"\][\s\S]*?\)::after\s*\{[\s\S]*?content:\s*"R"/);
  assert.match(table, /renderCardBack\(index\)/);
  assert.match(table, /tableCardBackSvgMarkup/);
  assert.match(cardPresentation, /data-card-state="unknown"/);
  assert.match(cardPresentation, /table-card-back-river/);
});

test('the card picker renders four explicit suit rows with unchanged card identities', () => {
  assert.match(logic, /const card = rank \+ suit\.id/);
  assert.match(logic, /class="deck-suit-row" data-picker-suit="\$\{suit\.id\}"/);
  assert.match(logic, /class="deck-ranks"/);
  assert.match(logic, /aria-pressed="\$\{isSelected\}"/);
  assert.match(logic, /data-deck-card="\$\{card\}" \$\{isUnavailable \? 'disabled' : ''\}/);
  assert.match(visualSystem, /grid-template-columns:\s*repeat\(13, minmax\(36px, 1fr\)\)/);
});

test('the range matrix remains a dense 13 by 13 LTR poker matrix', () => {
  assert.match(logic, /RANKS\.forEach\(\([^)]*row[^)]*\) => RANKS\.forEach\(\([^)]*(?:col|column)[^)]*\) =>/);
  assert.match(visualSystem, /\.strategy-grid\s*\{[\s\S]*?direction:\s*ltr/);
  assert.match(visualSystem, /grid-template-columns:\s*repeat\(13, minmax\(31px, 1fr\)\)/);
  assert.match(logic, /hand-\$\{handKind\}/);
  assert.match(visualSystem, /\.hand-cell\.hand-pair::before/);
  assert.match(visualSystem, /\.hand-cell\.hand-suited::before/);
  assert.match(visualSystem, /\.hand-cell\.hand-offsuit::before/);
});

test('matrix selection and hover use bounded non-color emphasis without zoom', () => {
  assert.match(logic, /button\.setAttribute\('aria-pressed', String\(isSelected\)\)/);
  assert.match(visualSystem, /\.hand-cell\.selected,[\s\S]*?\.hand-cell\[aria-pressed="true"\]\s*\{[^}]*box-shadow:\s*inset/);
  assert.match(visualSystem, /\.hand-cell:hover\s*\{[^}]*transform:\s*none/);
  assert.doesNotMatch(visualSystem, /scale\(1\.[1-9]/);
});

test('mixed strategy cells and detailed allocations share stable semantic action colors', () => {
  assert.match(logic, /class="matrix-mix-bar"/);
  assert.match(logic, /data-action-kind="\$\{visualActionKind\(action\)\}"/);
  for (const [kind, token] of [
    ['aggressive', 'action-aggressive'], ['passive', 'action-passive'],
    ['fold', 'action-fold'], ['all-in', 'action-all-in'], ['mixed', 'action-mixed'],
  ]) {
    assert.ok(visualSystem.includes(`[data-action-kind="${kind}"]`), kind);
    assert.ok(visualSystem.includes(`var(--${token})`), token);
  }
});

test('frequency bars expose exact values and a primary stacked representation', () => {
  assert.match(html, /id="actionFrequencyStack"[^>]*aria-label="Open 76%, Limp 10%, Fold 14%"/);
  assert.match(html, /data-action-kind="aggressive" style="width:76%"/);
  assert.match(html, /data-action-kind="passive" style="width:10%"/);
  assert.match(html, /data-action-kind="fold" style="width:14%"/);
  assert.match(logic, /container\.setAttribute\('aria-label', label\)/);
  assert.match(logic, /barEl\.style\.width = action\.value \+ '%'/);
  assert.match(logic, /numEl\.textContent = action\.value \? action\.value \+ '%' : '—'/);
});

test('recommendations distinguish decision, provenance, metadata, and warnings', () => {
  assert.match(html, /id="recommendation"/);
  assert.match(html, /id="sourceBadge"[^>]*>HEURISTIC</);
  assert.match(html, /id="strategyMeta" hidden/);
  assert.match(html, /id="strategyWarnings" role="note" hidden/);
  assert.match(logic, /const claimPolicy = strategyClaimPolicy\(strategyResult\)/);
  assert.match(logic, /claimPolicy\.sourceVersion/);
  assert.match(logic, /claimPolicy\.coverage\.kind === 'exact'/);
  assert.match(logic, /localizedStrategyLimitation\(claimPolicy\)/);
  assert.match(logic, /\.\.\.localizedStrategyWarnings\(strategyResult\)/);
  assert.match(logic, /\[\.\.\.new Set\(warnings\)\]\.join/);
  assert.doesNotMatch(html, /id="sourceBadge"[^>]*>(?:GTO|DEEP CFR)/i);
});

test('Equity uses reusable multiway series while retaining separate win and tie values', () => {
  assert.match(logic, /data-player-series="\$\{index\}"/);
  assert.match(logic, /<span>\$\{t\('Win'\)\}<\/span><strong[^>]*>\$\{win\}<\/strong>/);
  assert.match(logic, /<span>\$\{t\('Tie'\)\}<\/span><strong[^>]*>\$\{tie\}<\/strong>/);
  assert.match(logic, /aria-valuenow="\$\{ariaValue\}"/);
  assert.match(visualSystem, /equity-result-card \{ --series-color: var\(--series-0\)/);
  for (let index = 1; index < 10; index += 1) {
    assert.match(visualSystem, new RegExp(`equity-result-card\\[data-player-series="${index}"\\]`));
  }
  assert.match(html, /id="equitySplitSummary"/);
});

test('the poker table retains seat mapping and adds semantic presentation states', () => {
  assert.match(table, /id="seat-\$\{i\}"/);
  assert.match(table, /data-seat-index="\$\{i\}"/);
  assert.match(table, /i === 0 \? ' is-hero'/);
  assert.match(table, /classList\.toggle\('is-actor', isActor\)/);
  assert.match(table, /classList\.toggle\('is-folded'/);
  assert.match(table, /classList\.toggle\('is-all-in'/);
  assert.match(table, /dealer\.toggleAttribute\('hidden', !isDealer\)/);
  assert.match(table, /TABLE_FALLBACK_ANCHORS = Object\.freeze/);
  assert.match(table, /presentation\?\.geometry\?\.playerUnit/);
  assert.doesNotMatch(table, /Math\.(?:sin|cos)\(/);
});

test('table markup fixes the invalid height attribute and remains presentation-only', () => {
  assert.doesNotMatch(table, /height="auto"/);
  assert.match(table, /viewBox="0 0 1000 650" width="100%"/);
  assert.match(table, /role="img" aria-labelledby="poker-table-title"/);
  assert.match(table, /Presentation-only state/);
  assert.doesNotMatch(table, /applyAction|legalActions|PokerState|DecisionContext|calculateEquity/);
});

test('table cards use shared semantic suit classes without inline casino colors', () => {
  assert.match(cardPresentation, /const SUITS = Object\.freeze/);
  for (const suit of ['h', 's', 'd', 'c']) assert.match(cardPresentation, new RegExp(`${suit}: Object\\.freeze`));
  assert.match(cardPresentation, /card--suit-\$\{escapeMarkup\(presentation\.id\)\}/);
  assert.match(table, /presentation\.tableCardSvgMarkup/);
  assert.doesNotMatch(table, /#e74c3c|#3498db|#2ecc71|#3a1e04|#1e4c31|#0d2617/);
});

test('Midnight, Graphite, and Daylight keep action and suit meanings stable', () => {
  for (const theme of ['midnight', 'graphite', 'daylight']) {
    assert.match(css, new RegExp(`\\[data-theme="${theme}"\\]`));
    const block = css.match(new RegExp(`\\[data-theme="${theme}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
    assert.doesNotMatch(block, /--action-(?:fold|passive|aggressive|all-in|mixed)/);
    assert.doesNotMatch(block, /--suit-(?:heart|spade|diamond|club)/);
  }
  assert.match(css, /--suit-spade:\s*#18201c/);
  assert.match(visualSystem, /\[data-theme="daylight"\][\s\S]*?--poker-table-surface-start/);
});

test('responsive, RTL, and reduced-motion rules preserve poker semantics', () => {
  assert.match(visualSystem, /@media \(max-width: 768px\)[\s\S]*?\.deck-ranks[\s\S]*?overflow-x:\s*auto/);
  assert.match(visualSystem, /@media \(max-width: 768px\)[\s\S]*?\.riverline-poker-table\s*\{\s*min-width:\s*560px/);
  assert.match(visualSystem, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\[dir="rtl"\] \.strategy-grid[\s\S]*?direction:\s*ltr/);
});

test('poker and strategy safety entry points remain intact', () => {
  for (const symbol of ['deriveDecisionContext', 'calculateEquity', 'evaluateHand']) {
    assert.match(logic, new RegExp(symbol));
  }
  assert.match(strategy, /calculatePreflopFallbackStrategy/);
  assert.match(strategy, /calculatePostflopHeuristicStrategy/);
  assert.match(logic, /board: parsedBoard,[\s\S]*?heroCards: parsedHero,[\s\S]*?dealerPos: dealerPos,[\s\S]*?activePlayers: decisionContext\.tableSize/);
});
