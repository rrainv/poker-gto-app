import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createProductionPickerHarness } from './uiqa001r_card_picker_adapter.mjs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const productTranslations = fs.readFileSync(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8');

test('Playbook retires the standalone guardrail panel while preserving compact source provenance', () => {
  assert.doesNotMatch(html, /id="playbookGuardrailPanel"/);
  assert.match(html, /id="sourceBadge"[^>]+aria-describedby="strategySourceProvenance"/);
  assert.match(html, /id="strategySourceProvenance" class="sr-only"/);
  assert.match(logic, /sourceBadge\.setAttribute\('aria-label'/);
  assert.match(logic, /strategyPolicySummary\(claimPolicy\)/);
});

test('dead-card controls expose a compact, canonical available-deck summary', () => {
  const deadControls = html.slice(html.indexOf('Known burned / dead'), html.indexOf('data-slots="dead"'));
  assert.match(deadControls, /id="deadCardCount"/);
  assert.match(deadControls, /id="deckCount"/);
  assert.match(deadControls, /data-i18n="Available"/);
  assert.match(logic, /callPlaybookStateBridge\('getState'\)/);
  assert.match(logic, /remainingCards\(isHandMode\(\) \? 'hand' : 'gto'\)/);
  assert.doesNotMatch(logic.slice(logic.indexOf('function syncCanonicalDecisionDisplay'), logic.indexOf('function renderUnavailableStrategy')), /52\s*-\s*decisionContext\.heroCards/);
});

test('available-deck summary updates after hero, board, dead-card, replacement, and clearing changes', () => {
  const picker = createProductionPickerHarness();
  const summary = () => ({ ...picker.cardStateSummary() });

  picker.app.gto.hero = ['As', 'Kd'];
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '50', dead: '0' });
  picker.app.gto.board = ['2c', '3d', '4h'];
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '47', dead: '0' });
  picker.app.gto.dead = ['Qc'];
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '46', dead: '1' });
  picker.app.gto.dead[0] = 'Jc';
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '46', dead: '1' });
  picker.app.gto.dead.length = 0;
  picker.renderAllCards();
  assert.deepEqual(summary(), { available: '47', dead: '0' });
});

test('compact labels and provenance copy remain available to EN, RU, and HE catalogs', () => {
  assert.ok((i18n.match(/"Available"/g) || []).length >= 3);
  assert.match(html, /Heuristic guidance is active unless another source is named above\. Canonical hand state does not imply solved strategy\./);
  assert.match(productTranslations, /"Dead"/);
  assert.ok((productTranslations.match(/"Available"/g) || []).length >= 2);
  assert.equal((productTranslations.match(/"Heuristic guidance is active unless another source is named above\. Canonical hand state does not imply solved strategy\."/g) || []).length, 2);
});

test('dead-card header keeps the status group and Clear action in independent reflow-safe columns', () => {
  const header = html.slice(html.indexOf('playbook-dead-card-header'), html.indexOf('data-slots="dead"'));
  assert.match(header, /class="playbook-card-state-copy"[\s\S]*data-card-clear-command="clear_dead_set"/);
  assert.match(css, /\.playbook-dead-card-header\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(css, /\.playbook-card-state-summary\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.playbook-dead-card-header > \.small-link\s*\{[^}]*white-space:\s*nowrap/);
  assert.doesNotMatch(css.slice(css.indexOf('.playbook-dead-card-header'), css.indexOf('.small-link {', css.indexOf('.playbook-dead-card-header'))), /position:\s*absolute|margin-[^:]+:\s*-/);
});
