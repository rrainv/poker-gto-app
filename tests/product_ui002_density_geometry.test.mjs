import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');

const densityStart = css.indexOf('PRODUCT-UI-002: density, geometry, and component fit');
assert.ok(densityStart >= 0, 'PRODUCT-UI-002 CSS section must exist');
const density = css.slice(densityStart);

test('Action Path derives every node and connector from one local rail axis', () => {
  assert.match(html, /id="playbookDecisionPathPanel"/);
  assert.match(density, /--path-node-size: 20px/);
  assert.match(density, /--path-connector-width: 2px/);
  assert.match(density, /--path-rail-axis: calc\(\(var\(--path-node-size\) - var\(--path-connector-width\)\) \/ 2\)/);
  assert.match(density, /grid-template-columns: var\(--path-node-size\) minmax\(0, 1fr\)/);
  assert.match(density, /\.path-node[\s\S]*grid-column: 1[\s\S]*width: var\(--path-node-size\)/);
  assert.match(density, /\.path-step::before[\s\S]*inset-inline-start: var\(--path-rail-axis\)/);
  assert.match(density, /\.path-step\.active \.path-node[\s\S]*box-shadow: 0 0 6px/);
  assert.doesNotMatch(density, /left: auto/);
  assert.match(density, /#playbookDecisionPathPanel \{ overflow: visible; \}/);
});

test('short status labels stay content-sized, centered, and on one line', () => {
  assert.match(density, /\.status-badge,[\s\S]*\.theme-swatch-sharp \{/);
  assert.match(density, /min-height: 26px/);
  assert.match(density, /width: fit-content/);
  assert.match(density, /justify-content: center/);
  assert.match(density, /line-height: 1\.3/);
  assert.match(density, /white-space: nowrap/);
  assert.match(density, /overflow-wrap: normal/);
});

test('recommendation provenance has a dedicated grid row outside Strategy Mix flow', () => {
  assert.match(density, /\.recommend-top \{[\s\S]*display: grid;[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(density, /\.recommend-top #sourceBadge \{[\s\S]*justify-self: start;[\s\S]*white-space: nowrap/);
});

test('Betting Context composes its utility action in the heading and values in a responsive grid', () => {
  for (const id of ['heroPos', 'lastAction', 'facingSize', 'potSize', 'openCharts']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  const heading = html.slice(html.indexOf('class="playbook-inline-heading"'), html.indexOf('class="playbook-context-grid"'));
  const primary = html.slice(html.indexOf('class="playbook-context-primary"'), html.indexOf('class="fields playbook-context-sliders"'));
  assert.match(heading, /id="openCharts"/);
  assert.doesNotMatch(primary, /id="openCharts"/);
  assert.match(density, /\.playbook-context-grid \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(density, /@media \(min-width: 1200px\)[\s\S]*\.playbook-context-grid \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/);
  assert.match(density, /\.playbook-inline-heading #openCharts \{[\s\S]*white-space: nowrap/);
  assert.match(density, /\.playbook-context-field \.control-select \{ min-height: 36px; \}/);
  assert.match(density, /\.playbook-context-sliders \.slider-container[\s\S]*min-height: 48px/);
  assert.match(density, /\.playbook-context-sliders > \.field \{ grid-column: 1 \/ -1; \}/);
});

test('Hand Mode uses a compact post-start setup and highlights the current canonical step', () => {
  assert.match(logic, /workspace\.classList\.toggle\('is-hand-in-progress', Boolean\(state\)\)/);
  assert.match(logic, /section\.classList\.toggle\('is-current-hand-step', !section\.hidden\)/);
  assert.match(density, /\.playbook-hand-workspace\.is-hand-in-progress #handSetupSection/);
  assert.match(density, /\.playbook-hand-workspace \.is-current-hand-step/);
});

test('table seats use one centered compact player-unit anchor for cards and identity', () => {
  assert.match(table, /class="table-seat table-player-unit\$\{[^}]+\}"[^>]*data-card-anchor="center"/);
  assert.match(table, /class="table-hole-cards" transform="translate\(0, -94\)"/);
  assert.match(table, /class="table-seat-surface" x="-50" y="-34" width="100" height="70"/);
  assert.match(table, /const finalX = \(\(index - \(\(totalCards - 1\) \/ 2\)\) \* cardStep\) - 20/);
  assert.match(table, /renderCardBack\(index\)[\s\S]*const finalX = \(\(index - 0\.5\) \* 25\) - 20/);
  const cardIndex = table.indexOf('class="table-hole-cards"');
  const infoIndex = table.indexOf('class="table-seat-info"');
  assert.ok(cardIndex >= 0 && infoIndex > cardIndex, 'seat information must paint above cards');
  assert.match(table, /id="seat-position-\$\{i\}" class="table-seat-meta table-seat-position"/);
  assert.match(table, /id: `seat-stack-\$\{i\}`[\s\S]*className: 'table-seat-meta table-seat-stack'/);
  assert.match(table, /id="seat-status-\$\{i\}" class="table-seat-meta table-seat-status"/);
  assert.match(table, /this\.setPokerAmount\(stack/);
  assert.doesNotMatch(table, /table-seat-diagnostic/);
  assert.match(logic, /const scenarioPlayers = Array\.from/);
  assert.match(logic, /players: scenarioPlayers/);
  assert.match(density, /\.table-seat-stack[\s\S]*font: 750 10px/);
  assert.match(density, /\.table-seat-status[\s\S]*font: 750 7px/);
});

test('Settings and collapsed table use viewport-safe responsive layout contracts', () => {
  assert.match(html, /class="modal overlay-surface settings-modal"/);
  assert.match(density, /--z-mode-rail: 30/);
  assert.match(density, /--z-toast: 60/);
  assert.match(density, /--z-modal-backdrop: 100/);
  assert.match(density, /\.modal-backdrop \{[\s\S]*z-index: var\(--z-modal-backdrop\)/);
  assert.match(density, /\.modal-backdrop > \.modal \{[\s\S]*z-index: 1/);
  assert.match(density, /width: min\(940px, calc\(100vw - \(var\(--space-7\) \* 2\)\)\)/);
  assert.match(density, /max-width: calc\(100vw - \(var\(--space-7\) \* 2\)\)/);
  assert.match(density, /height: min\(760px, calc\(100dvh - \(var\(--space-6\) \* 2\)\)\)/);
  assert.match(density, /\.settings-modal \.modal-body \{ min-width: 0; overflow: auto; overscroll-behavior: contain; \}/);
  assert.match(density, /grid-template-columns: minmax\(0, 1\.55fr\) minmax\(220px, \.75fr\)/);
  assert.match(density, /\.playbook-decision-workspace\.is-table-collapsed \.playbook-table-toggle/);
  assert.match(logic, /closest\('\.playbook-decision-workspace'\)\?\.classList\.toggle\('is-table-collapsed', collapsed\)/);
  assert.doesNotMatch(density, /(?:^|\n)\s*width:\s*(?:1024|1280|1440|1600)px/);
});
