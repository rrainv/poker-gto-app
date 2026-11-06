// ANALYZE-001a-FINISH: the poker action "Open" (verdict, mix label) is open-raise per
// docs/TERMINOLOGY.md. It once shared a lookup key with the Training session-length
// option "Open" (unbounded), so Russian read «Без ограничения». They are separate keys now.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp } from './helpers/app-under-test.mjs';

const app = await bootApp({ width: 1920 });
const translations = app.window.appTranslations;

test('the Open action resolves to open-raise in every language (terminology sheet)', () => {
  assert.equal(translations.en.Open, 'Open');
  assert.equal(translations.ru.Open, 'Опен-рейз');
  assert.equal(translations.he.Open, 'אופן-רייז');
});

test('the Training session-length option has its own key and keeps its meaning', () => {
  assert.equal(translations.en['No limit'], 'No limit');
  assert.equal(translations.ru['No limit'], 'Без ограничения');
  assert.equal(translations.he['No limit'], 'ללא הגבלה');
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  assert.match(html, /<option value="open" data-i18n="No limit">No limit<\/option>/);
});

test('the Home game "Open" button no longer borrows the action key', () => {
  assert.equal(translations.ru['Open this session'], 'Открыть');
  assert.equal(translations.he['Open this session'], 'פתח');
  const source = fs.readFileSync(new URL('../app/src/application/home-game-bootstrap.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /translate\(browserWindow, 'Open'\)/);
});

test('the Hand destination is the play surface: the matrix lives on Analyze only (deliberate, pre-dates ANALYZE-001a)', () => {
  const css = fs.readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  assert.match(css, /#gtoMode\[data-product-destination="hand"\] #chartView,[\s\S]{0,200}display: none !important;/);
});
