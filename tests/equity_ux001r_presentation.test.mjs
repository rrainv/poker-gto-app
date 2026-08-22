import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');
const table = fs.readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const cardPresentation = fs.readFileSync(new URL('../app/src/application/card-presentation.mjs', import.meta.url), 'utf8');

const domBackRule = css.match(/\.card-slot\.facedown,\s*\.riverline-card-back\s*\{[\s\S]*?\}/)?.[0] ?? '';
const domBackDecoration = css.match(/\.card-slot\.facedown::after,\s*\.riverline-card-back::after\s*\{[\s\S]*?\}/)?.[0] ?? '';
const riverlineBackDecoration = css.match(/:is\([\s\S]*?\.riverline-card-back\[data-card-preview-back-style="riverline"\][\s\S]*?\)::after\s*\{[\s\S]*?\}/)?.[0] ?? '';
const resultBackRule = css.match(/\.equity-result-unknown \.poker-card-back\s*\{[^}]+\}/)?.[0] ?? '';
const compact1080 = css.match(/@media \(min-width: 1500px\) and \(max-height: 1080px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

test('Equity DOM card backs own a bounded positioned card box', () => {
  assert.match(logic, /class="poker-card-back riverline-card-back"/);
  assert.match(domBackRule, /position:\s*relative/);
  assert.match(domBackRule, /display:\s*block/);
  assert.match(domBackRule, /box-sizing:\s*border-box/);
  assert.match(domBackRule, /overflow:\s*hidden/);
  assert.match(resultBackRule, /width:\s*var\(--card-size-result-width\)/);
  assert.match(resultBackRule, /height:\s*var\(--card-size-result-height\)/);
  assert.match(resultBackRule, /flex:\s*0 0 var\(--card-size-result-width\)/);
});

test('the R decoration is contained by its card and no longer targets SVG table groups', () => {
  assert.match(domBackDecoration, /position:\s*absolute/);
  assert.match(domBackDecoration, /inset:\s*12%/);
  assert.match(riverlineBackDecoration, /inset:\s*25% 20%/);
  assert.match(riverlineBackDecoration, /border-radius:\s*50%/);
  assert.doesNotMatch(css, /\.poker-card-back::after/);
  assert.match(table, /presentation\.tableCardBackSvgMarkup/);
  assert.match(cardPresentation, /class="table-card-back poker-card-svg poker-card-back"/);
  assert.doesNotMatch(cardPresentation, /poker-card-svg riverline-card-back|table-card-back riverline-card-back/);
});

test('known Equity result cards continue to use the accepted shared face renderer', () => {
  assert.match(logic, /training-readonly-card riverline-card/);
  assert.match(logic, /\$\{cardMarkup\(card\)\}/);
  assert.match(css, /\.equity-result-card \.training-readonly-card\s*\{\s*width:\s*var\(--card-size-result-width\);\s*height:\s*var\(--card-size-result-height\)/);
});

test('1080p result density reclaims vertical space without shrinking cards or typography', () => {
  assert.ok(compact1080, '1080p desktop density contract must exist');
  assert.match(compact1080, /\.equity-result-head \{ padding-block: 12px 9px; \}/);
  assert.match(compact1080, /\.equity-headline \{ padding-bottom: var\(--space-4\); \}/);
  assert.match(compact1080, /\.equity-scenario \{ padding-bottom: var\(--space-4\); \}/);
  assert.match(compact1080, /\.equity-scenario-context \{ gap: var\(--space-2\); padding: var\(--space-3\); \}/);
  assert.match(compact1080, /\.equity-bars \{ gap: var\(--space-3\); padding: var\(--space-4\); \}/);
  assert.match(compact1080, /\.equity-result-card \{ gap: var\(--space-2\); padding: var\(--space-3\); \}/);
  assert.match(compact1080, /\.equity-result-summary > div \{ padding: var\(--space-3\) var\(--space-4\); \}/);
  const declarations = compact1080.slice(compact1080.indexOf('{') + 1);
  assert.doesNotMatch(declarations, /font-size|line-height|\bwidth:\s*\d|\bheight:\s*\d|display:\s*none/);
});
