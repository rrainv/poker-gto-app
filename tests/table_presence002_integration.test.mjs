import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const presentation = readFileSync(
  new URL('../app/src/application/table-presentation.mjs', import.meta.url),
  'utf8',
);
const trainingBridge = readFileSync(
  new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);

function sourceBetween(source, start, end) {
  return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
}

test('visible Hand composition is table-first with one adjacent action and replay rail', () => {
  const table = html.indexOf('id="table-wrapper"');
  const rail = html.indexOf('id="handInteractionRail"', table);
  const dock = html.indexOf('id="handStageDock"', rail);
  const history = html.indexOf('id="handHistorySection"', dock);
  const timeline = html.indexOf('id="handTimelineStage"', history);
  assert.ok(table > 0 && table < rail && rail < dock && dock < history && history < timeline);
  assert.match(html, /id="handActionAmountRange"[^>]*type="range"/);
  assert.match(html, /id="handActionAmountBb"[^>]*type="number"/);
  assert.match(html, /id="handCommitSizedAction"[^>]*type="button"/);
  assert.match(css, /REPLAY-RAIL-NAV-001[\s\S]*?#handInteractionRail:not\(\[hidden\]\)[\s\S]*?display:\s*grid\s*!important/);
  assert.match(css, /#handActionHistory:is\(\.replay-timeline--compact, \.replay-timeline--review\)[\s\S]*?overflow-y:\s*auto/);
  assert.match(css, /html:has\(#gtoMode\.active\[data-product-destination="hand"\]\)\s*\{[^}]*scrollbar-gutter:\s*stable/);
  assert.match(css, /\.hand-action-sizing\s*\{[\s\S]*?background:\s*var\(--surface-inset\)/);
});

test('duplicate Hand submissions lock before the canonical transition and sizing uses canonical bounds', () => {
  const applyAction = sourceBetween(
    logic,
    'function applyCanonicalHandAction(',
    'function commitCanonicalSizedAction(',
  );
  const sizing = sourceBetween(
    logic,
    'function chooseCanonicalSizedAction(',
    'function applyCanonicalHandAction(',
  );
  assert.match(applyAction, /if \(app\.playbookHandDraft\.actionSubmissionLocked\) return null/);
  assert.ok(
    applyAction.indexOf('actionSubmissionLocked = true')
      < applyAction.indexOf("callPlaybookStateBridge('applyAction'"),
  );
  assert.match(logic, /button\.disabled = app\.playbookHandDraft\.actionSubmissionLocked/);
  assert.match(logic, /applyCanonicalHandAction\(type\), \{ once: true \}/);
  assert.match(sizing, /option\.minToMilliBb/);
  assert.match(sizing, /option\.maxToMilliBb/);
  assert.match(sizing, /game\?\.chipUnitMilliBb/);
});

test('Replay seeking and compact Analyze projection reuse the application bridges', () => {
  assert.match(logic, /\.replay-timeline-seek\[data-frame-index\]/);
  assert.match(logic, /callPlaybookStateBridge\('selectReplayFrame', frameIndex\)/);
  assert.match(logic, /productDestination === 'analyze'/);
  assert.match(logic, /projection: analyzeProjection \? 'analyze' : null/);
  assert.match(logic, /interaction: analyzeProjection \? 'passive' : null/);
  assert.match(trainingBridge, /snapshot\.currentDecision\.legalActions/);
  assert.match(trainingBridge, /createReplayTimelineViewModel/);
});

test('theme, card, density, layout, RTL, and reduced-motion authorities remain compatible', () => {
  assert.match(renderer, /RiverlineCardPresentation/);
  assert.match(renderer, /RiverlinePokerPrimitives/);
  assert.match(css, /var\(--poker-table-rail-end\)/);
  assert.match(css, /var\(--poker-table-seat-hero\)/);
  assert.match(css, /\[data-density="compact"\] #visual-table-container/);
  assert.match(css, /html\[data-layout-preset\][\s\S]*?data-table-projection="play"/);
  assert.match(css, /data-table-projection="review"/);
  assert.match(css, /data-table-projection="analyze"/);
  assert.match(css, /data-table-projection="saved_preview"/);
  assert.match(css, /\[dir="rtl"\][\s\S]*?\.riverline-poker-table[\s\S]*?direction:\s*ltr/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.table-player-unit/);
  assert.match(css, /\.table-wrapper\[data-table-projection\]:not\(\.collapsed\)[\s\S]*?max-height:\s*none/);
});

test('presentation and renderer introduce no strategy, legality, or accounting authority', () => {
  assert.doesNotMatch(
    presentation,
    /StrategyProvider|StrategyResult|probability|frequency|calculateEquity|applyAction|getLegalActionSpec|shared\/poker-domain/i,
  );
  assert.doesNotMatch(renderer, /shared\/poker-domain|StrategyProvider|calculateEquity/);
  assert.doesNotMatch(
    renderer,
    /potMilliBb\s*[-+*/]|streetContributionMilliBb\s*[-+*/]|currentStackMilliBb\s*[-+*/]/,
  );
  assert.doesNotMatch(`${presentation}\n${renderer}`, /setInterval|requestAnimationFrame/);
});
