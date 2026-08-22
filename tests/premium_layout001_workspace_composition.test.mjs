import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const ticketCss = css.slice(css.indexOf('PREMIUM-LAYOUT-001: bounded desktop workspace composition'));

test('shared workspace primitives define bounded, readable, rail, and dense composition roles', () => {
  assert.match(ticketCss, /--workspace-frame-standard:\s*1380px/);
  assert.match(ticketCss, /--workspace-frame-wide:\s*1500px/);
  assert.match(ticketCss, /--workspace-frame-dense:\s*1680px/);
  assert.match(ticketCss, /--workspace-readable-max:\s*1120px/);
  assert.match(ticketCss, /\.workspace-frame\s*\{[\s\S]*?width:\s*min\(100%, var\(--workspace-frame-max/);
  assert.match(ticketCss, /:is\(\.workspace-layout, \.playbook-workspace, \.training-workspace, \.equity-workspace\)/);
  assert.match(ticketCss, /:is\(\.workspace-stage, \.playbook-decision-workspace, \.training-decision-column, \.equity-input-stack\)/);
  assert.match(ticketCss, /:is\(\.workspace-rail, \.playbook-context-rail,[\s\S]*?\.equity-output-stack\)/);
  assert.match(ticketCss, /\.workspace-readable\s*\{[\s\S]*?var\(--workspace-readable-max\)/);
});

test('Hand and Analyze share one wide frame while keeping deliberate stage and rail widths', () => {
  const playbook = html.slice(html.indexOf('id="gtoMode"'), html.indexOf('<template id="rangeCalibrationTemplate"'));
  assert.match(playbook, /class="workspace-frame workspace-frame--wide"/);
  assert.match(playbook, /class="side-stack playbook-context-rail"/);
  assert.match(playbook, /class="main-content playbook-decision-workspace"/);
  assert.match(playbook, /class="analysis-panel-content workspace-readable"/);
  assert.match(ticketCss, /data-product-destination="analyze"[\s\S]*?minmax\(260px, 292px\)[\s\S]*?minmax\(240px, 268px\)/);
  assert.match(ticketCss, /data-product-destination="hand"[\s\S]*?grid-template-columns:\s*minmax\(280px, 320px\) minmax\(0, 1fr\)/);
  assert.match(ticketCss, /#visual-table-container\s*\{[\s\S]*?max-width:\s*900px/);
  assert.match(ticketCss, /\.hand-action-dock \.hand-legal-actions \.ui-button\s*\{\s*flex-grow:\s*0/);
});

test('Home, Saved, Training, Personal Strategy, and Equity consume the same frame system', () => {
  assert.match(html, /id="homeMode"[\s\S]*?class="workspace-frame workspace-frame--standard"[\s\S]*?id="homeWorkspace"/);
  assert.match(html, /id="rangeCalibrationMount" class="workspace-frame workspace-frame--wide workspace-dense-surface"/);
  assert.match(html, /id="trainingMode"[\s\S]*?class="workspace-frame workspace-frame--wide"[\s\S]*?id="trainingWorkspace"/);
  assert.match(html, /id="equityMode"[\s\S]*?class="workspace-frame workspace-frame--standard"[\s\S]*?class="equity-workspace"/);
  assert.match(ticketCss, /\.home-workspace\s*\{\s*width:\s*min\(100%, var\(--workspace-frame-standard\)\)/);
  assert.match(ticketCss, /\.range-calibration-workspace\s*\{\s*width:\s*min\(100%, var\(--workspace-frame-wide\)\)/);
  assert.match(ticketCss, /\.training-workspace\s*\{\s*width:\s*min\(100%, var\(--workspace-frame-wide\)\)/);
  assert.match(ticketCss, /\.equity-workspace\s*\{[\s\S]*?minmax\(var\(--workspace-rail-min\), var\(--workspace-rail-max\)\)/);
});

test('large desktop columns remain compact and 1024 desktop stacks primary content before rails', () => {
  assert.match(ticketCss, /@media \(min-width: 1320px\)[\s\S]*?\.training-workspace[\s\S]*?minmax\(240px, 270px\)[\s\S]*?minmax\(250px, 292px\)/);
  assert.match(ticketCss, /@media \(max-width: 1100px\)[\s\S]*?#gtoMode \.playbook-workspace\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(ticketCss, /@media \(max-width: 1100px\)[\s\S]*?\.training-workspace,[\s\S]*?\.equity-workspace\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(ticketCss, /\.training-decision-column\s*\{\s*order:\s*1/);
  assert.match(ticketCss, /\.equity-output-stack\s*\{\s*width:\s*100%;\s*max-width:\s*none/);
  assert.match(ticketCss, /data-hand-stage="private-cards"[\s\S]*?\.playbook-context-rail\s*\{\s*order:\s*1/);
});

test('workspace alignment uses logical properties and does not introduce page-level horizontal scrolling', () => {
  assert.match(ticketCss, /\.workspace-header\s*\{[\s\S]*?padding-inline:\s*max\(/);
  assert.match(ticketCss, /margin-inline:\s*auto/);
  assert.match(ticketCss, /max-inline-size:\s*var\(--workspace-readable-measure\)/);
  assert.doesNotMatch(ticketCss, /(?:^|\n)\s*(?:html|body)\s*\{[^}]*overflow-x:\s*(?:auto|scroll)/);
});
