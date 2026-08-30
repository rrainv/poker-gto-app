import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');

test('Equity street labels and live board slots share one five-column layout', () => {
  assert.match(
    html,
    /class="equity-board-layout equity-board-order"[^>]*dir="ltr"[\s\S]*?class="equity-street-guide"[\s\S]*?data-slots="eqboard"/
  );
  assert.match(
    css,
    /\.equity-board-layout\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*var\(--poker-card-width,\s*48px\)\)/
  );
  assert.match(
    css,
    /\.equity-board-layout\s*>\s*\.equity-street-guide,[\s\S]*?\.equity-board-layout\s*>\s*\.equity-board-cards\s*\{[^}]*display:\s*contents/
  );
});

test('the Flop set spans columns one through three while Turn and River map to four and five', () => {
  assert.match(css, /\[data-equity-street="flop"\]\s*\{[^}]*grid-column:\s*1\s*\/\s*span\s*3/);
  assert.match(css, /\[data-equity-street="turn"\]\s*\{[^}]*grid-column:\s*4/);
  assert.match(css, /\[data-equity-street="river"\]\s*\{[^}]*grid-column:\s*5/);
  assert.match(css, /equity-board-cards\s*>\s*\.board-card-set-editor--flop\s*\{[^}]*grid-column:\s*1\s*\/\s*span\s*3/);
  assert.match(css, /board-card-set-editor\[data-card-set-index="3"\]\s*\{[^}]*grid-column:\s*4/);
  assert.match(css, /board-card-set-editor\[data-card-set-index="4"\]\s*\{[^}]*grid-column:\s*5/);
});

test('Hebrew preserves the LTR Flop to Turn to River semantic and slot order', () => {
  const flop = html.indexOf('data-equity-street="flop"');
  const turn = html.indexOf('data-equity-street="turn"');
  const river = html.indexOf('data-equity-street="river"');
  assert.ok(flop >= 0 && flop < turn && turn < river);
  assert.match(css, /\[dir="rtl"\]\s+\.equity-board-layout\s*\{[^}]*direction:\s*ltr[^}]*unicode-bidi:\s*isolate/);
  assert.doesNotMatch(css, /\.equity-board-layout[^}]*direction:\s*rtl/);
});

test('Analyze and Equity Board compositions scope set-editor geometry without internal scrollbars', () => {
  assert.match(css, /\.playbook-board-layout\s*\{[^}]*column-gap:\s*var\(--space-3\)[^}]*overflow:\s*visible/s);
  assert.match(css, /playbook-board-cards\s*>\s*\.board-card-set-editor--flop\s*\{[^}]*grid-column:\s*1\s*\/\s*span\s*3[^}]*grid-template-columns:\s*repeat\(3,\s*var\(--poker-card-width\)\)/s);
  assert.match(css, /playbook-board-cards\s*>\s*\.board-card-set-editor\[data-card-set-index="3"\]\s*\{[^}]*grid-column:\s*4/);
  assert.match(css, /playbook-board-cards\s*>\s*\.board-card-set-editor\[data-card-set-index="4"\]\s*\{[^}]*grid-column:\s*5/);
  assert.match(css, /\.equity-board-layout\s*\{[^}]*overflow:\s*visible/s);
});
