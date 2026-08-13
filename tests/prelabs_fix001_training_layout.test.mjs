import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const logic = fs.readFileSync(new URL('../app/src/core/logic.js', import.meta.url), 'utf8');

test('Training context marks compact values as atomic without freezing descriptive facing copy', () => {
  for (const id of ['trainingStreetLabel', 'trainingPositionVal', 'trainingStackVal', 'trainingPotVal', 'trainingTableVal']) {
    assert.match(html, new RegExp(`id="${id}" class="[^"]*training-context-value--atomic`));
  }
  assert.doesNotMatch(html, /id="trainingFacingVal" class="[^"]*training-context-value--atomic/);
  assert.match(css, /\.training-context-strip \.training-context-value--atomic\s*\{\s*white-space:\s*nowrap/);
  assert.match(css, /\.training-context-strip strong\s*\{[^}]*overflow-wrap:\s*normal[^}]*word-break:\s*normal/);
  assert.doesNotMatch(css, /\.training-context-strip strong\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test('the constrained desktop grid reflows before atomic values can split', () => {
  const constrained = css.match(/@media \(max-width: 1024px\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(constrained, /\.training-context-strip\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(constrained, /\.training-context-strip > div:nth-child\(odd\)[^}]*border-inline-start:\s*0/);
  assert.match(constrained, /\.training-context-strip > div:nth-child\(n \+ 3\)[^}]*border-top:/);
  assert.doesNotMatch(css, /(?:html|body|\.riverline-shell)\s*\{[^}]*overflow-x:\s*(?:scroll|auto)/);
  assert.match(logic, /const potInfo = \$\('#trainingPotInfo'\);[\s\S]{0,100}style\.removeProperty\('display'\)/);
  assert.doesNotMatch(logic, /potInfo\.style\.display\s*=\s*'flex'/);
});

test('Training numeric and poker context tokens retain LTR isolation in Hebrew', () => {
  for (const id of ['trainingPositionVal', 'trainingStackVal', 'trainingPotVal', 'trainingTableVal']) {
    assert.match(html, new RegExp(`id="${id}" class="[^"]*poker-data-token`));
  }
  assert.match(css, /\.poker-data-token,[\s\S]*direction:\s*ltr;[\s\S]*unicode-bidi:\s*isolate/);
});
