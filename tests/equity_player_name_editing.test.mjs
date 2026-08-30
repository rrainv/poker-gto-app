import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const slice = (start, end) => logic.slice(logic.indexOf(start), logic.indexOf(end));

test('player names use an in-place label/input editor with commit, cancel, and blur semantics', () => {
  assert.match(logic, /data-equity-player-name-label="\$\{playerIndex\}"[\s\S]*?<input class="equity-player-name"[^>]*hidden>/);
  assert.match(logic, /event\.key === 'Enter'[\s\S]*?finishEquityPlayerNameEdit\(input\)/);
  assert.match(logic, /event\.key === 'Escape'[\s\S]*?finishEquityPlayerNameEdit\(input, \{ cancel: true \}\)/);
  assert.match(logic, /input\.addEventListener\('blur', \(\) => finishEquityPlayerNameEdit\(input\)\)/);
  assert.match(logic, /input\.select\(\)/);
});

test('blank names retain the existing default display labels', () => {
  assert.match(logic, /player\.name = input\.value\.trim\(\)\.slice\(0, 40\)/);
  assert.match(logic, /return customName \|\| equityDefaultPlayerLabel\(playerIndex\)/);
  assert.match(logic, /playerIndex === 0 \? t\('Hero'\) : t\('Player \{number\}'/);
});

test('rename commits are presentation-only and equity-request v1 excludes names', () => {
  const editing = slice('function syncEquityPlayerNamePresentation', 'function renderEquityComparison');
  assert.doesNotMatch(editing, /setEquityPending|updateEquityReadiness|createEquityHandAnalysisProjection|RangeAnalysisFacts|calculateEquity/);
  assert.match(editing, /lastAnalysisLabels/);
  assert.match(editing, /staleAnalysisLabels/);
  const request = slice('function equityRequestFromCurrentInputs', 'function formatEquityCombinationCount');
  assert.match(request, /id: player\.id,[\s\S]*?cards:/);
  assert.doesNotMatch(request, /name|equityPlayerLabel/);
});

test('the inline editor remains bounded by the accepted compact header', () => {
  assert.match(css, /\.equity-player-name-editor\s*\{[^}]*height:\s*26px[^}]*flex:\s*1 1 auto[^}]*display:\s*grid/s);
  assert.match(css, /\.equity-player-name-label,[\s\S]*?\.equity-player-name\s*\{[^}]*width:\s*100%[^}]*height:\s*26px[^}]*padding:\s*0 var\(--space-2\)/s);
  assert.match(css, /\.equity-player-name-label\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*overflow:\s*hidden/s);
});
