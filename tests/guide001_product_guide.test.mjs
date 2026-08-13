import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const guideHtml = html.slice(
  html.indexOf('id="infoMode"'),
  html.indexOf('id="cardModal"'),
);

test('Guide describes the current Playbook workflow and pricing terminology', () => {
  for (const concept of [
    'Strategy Mix',
    'What goes into this decision?',
    'Current spot views',
    'Facing size is the current wager context, not necessarily the exact amount you must call.',
    'Scenario mode:',
    'Hand mode:',
  ]) assert.match(guideHtml, new RegExp(concept.replaceAll(/[?]/g, '\\$&')));
  assert.match(guideHtml, /arbitrary study snapshot/);
  assert.match(guideHtml, /complete legal hand history/);
  assert.match(guideHtml, /Actions, history, and prices are derived from the hand/);
});

test('Guide documents the current Training, Equity, and Matrix behavior', () => {
  for (const concept of [
    'Training generates legal hand trajectories',
    'Study hints are optional coaching prompts',
    'exact reference frequencies',
    'session progress',
    'exact enumeration',
    'Monte Carlo simulation',
    'progress, rate, and estimated time remaining',
    'Equity, Win, and Tie',
    'Cancel stops the calculation and keeps your configuration intact',
    'tint shows the dominant action',
    'Hover or focus a cell',
    'select it for exact action detail',
    'A full postflop Matrix expansion is not available yet',
    'exact-hand postflop recommendation',
  ]) assert.match(guideHtml, new RegExp(concept));
});

test('Guide states accounting, presentation, and heuristic provenance truthfully', () => {
  for (const concept of [
    'Home has no Riverline rake or deduction',
    'each seated player contributes 0.1 bb once per hand outside the contestable pot',
    'Classic Mirrored, Tournament, Clean Corner, or Clarity Corner',
    'display ten as T or 10',
    'deterministic heuristic strategy source',
    'Exact-hand postflop recommendations are heuristic',
    'preflop Matrix reflects the same source',
  ]) assert.match(guideHtml, new RegExp(concept));
  assert.match(guideHtml, /descriptive, not a weighted range-versus-range calculation/);
});

test('Guide no longer exposes stale product claims or terminology', () => {
  for (const staleTerm of [
    /Last Action/i,
    /Full range chart/i,
    /percentage\s+rake/i,
    /capped\s+rake/i,
    /solver[- ]tree/i,
    /tree upload/i,
    /model runtime/i,
    /Strategy Preview/i,
    /Total Equity/i,
    /every possible starting hand/i,
  ]) assert.doesNotMatch(guideHtml, staleTerm);
});

test('Guide copy remains on the existing translation path', () => {
  const visibleText = guideHtml.match(/<(?:h3|p)[^>]*>[^<]/g) || [];
  assert.ok(visibleText.length >= 15);
  assert.match(guideHtml, /data-i18n="Riverline currently uses a deterministic heuristic strategy source/);
  assert.match(guideHtml, /data-i18n="Training generates legal hand trajectories/);
  assert.match(guideHtml, /data-i18n="Add known hands or leave opponents random/);
});
