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

test('Flop spans slots one through three while Turn and River map to four and five', () => {
  assert.match(css, /\[data-equity-street="flop"\]\s*\{[^}]*grid-column:\s*1\s*\/\s*span\s*3/);
  assert.match(css, /\[data-equity-street="turn"\]\s*\{[^}]*grid-column:\s*4/);
  assert.match(css, /\[data-equity-street="river"\]\s*\{[^}]*grid-column:\s*5/);
  for (let index = 1; index <= 5; index += 1) {
    assert.match(
      css,
      new RegExp(`equity-board-cards\\s*>\\s*\\.card-slot:nth-child\\(${index}\\)\\s*\\{[^}]*grid-column:\\s*${index}`)
    );
  }
});

test('Hebrew preserves the LTR Flop to Turn to River semantic and slot order', () => {
  const flop = html.indexOf('data-equity-street="flop"');
  const turn = html.indexOf('data-equity-street="turn"');
  const river = html.indexOf('data-equity-street="river"');
  assert.ok(flop >= 0 && flop < turn && turn < river);
  assert.match(css, /\[dir="rtl"\]\s+\.equity-board-layout\s*\{[^}]*direction:\s*ltr[^}]*unicode-bidi:\s*isolate/);
  assert.doesNotMatch(css, /\.equity-board-layout[^}]*direction:\s*rtl/);
});
