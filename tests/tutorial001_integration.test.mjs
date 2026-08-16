import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [html, css, logic, bootstrap, controller, anchors, coach, translations] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/tutorial-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/tutorial/controller.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/tutorial/anchors.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/tutorial/coach-mark.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8'),
]);

test('Home exposes stable semantic anchors and one consistent manual restart action', () => {
  for (const anchor of ['home-overview', 'home-recent', 'home-review', 'home-quick-start']) {
    assert.match(html, new RegExp(`data-tutorial-anchor="${anchor}"`));
  }
  assert.match(anchors, /TUTORIAL_ANCHOR_ATTRIBUTE = 'data-tutorial-anchor'/);
  assert.match(html, /id="workspaceTutorialButton"[^>]+aria-label="Restart tutorial"/);
  assert.match(logic, /RiverlineTutorials\?\.workspaceChanged/);
  assert.match(logic, /RiverlineTutorials\?\.offerForWorkspace/);
});

test('coach mark supplies dialog semantics, keyboard controls, focus restoration, and active-only measurement', () => {
  assert.match(coach, /setAttribute\('role', 'dialog'\)/);
  assert.match(coach, /setAttribute\('aria-modal', 'false'\)/);
  assert.match(coach, /aria-labelledby/);
  assert.match(coach, /aria-describedby/);
  assert.match(coach, /event\.key === 'Escape'/);
  assert.match(coach, /event\.key === 'ArrowRight'/);
  assert.match(coach, /event\.key === 'ArrowLeft'/);
  assert.match(coach, /focusBeforeTutorial/);
  assert.match(coach, /removeActiveListeners/);
  assert.doesNotMatch(`${bootstrap}\n${controller}\n${anchors}`, /MutationObserver|setInterval|requestAnimationFrame/);
  assert.match(coach, /function show[\s\S]*?addActiveListeners/);
  assert.match(coach, /function hide[\s\S]*?removeActiveListeners/);
});

test('overlay uses design tokens, viewport bounds, RTL-safe logical properties, and reduced motion', () => {
  assert.match(css, /--z-tutorial: 90/);
  assert.match(css, /\.tutorial-coach[\s\S]*?var\(--surface-elevated\)/);
  assert.match(css, /\.tutorial-actions[\s\S]*?margin-inline/);
  assert.match(css, /max-height: calc\(100dvh/);
  assert.match(css, /@media \(max-width: 1100px\), \(max-height: 800px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.tutorial-spotlight/);
  assert.match(coach, /prefers-reduced-motion: reduce/);
  assert.match(coach, /behavior: reduced \? 'auto' : 'smooth'/);
});

test('tutorial translations contain the same complete EN/RU/HE key set', () => {
  const context = { window: {} };
  vm.runInNewContext(translations, context);
  const catalog = context.window.riverlineTutorialTranslations;
  const englishKeys = Object.keys(catalog.en).sort();
  assert.deepEqual(Object.keys(catalog.ru).sort(), englishKeys);
  assert.deepEqual(Object.keys(catalog.he).sort(), englishKeys);
  assert.match(Object.values(catalog.ru).join(' '), /[А-Яа-я]{2,}/u);
  assert.match(Object.values(catalog.he).join(' '), /[א-ת]{2,}/u);
});

test('tutorial foundation is isolated from poker, strategy, Equity, Training, Replay, and SavedStudyObject authorities', () => {
  const foundation = `${controller}\n${anchors}\n${coach}`;
  assert.doesNotMatch(foundation, /StrategyProvider|resolveStrategy|DecisionContext|SavedStudyObject|indexedDB|Equity|Training|Replay|poker-domain/);
  assert.doesNotMatch(bootstrap, /from ['"][^'"]*(?:strategy|equity|training|replay|saved-study|poker-domain)/i);
  assert.match(logic, /cancelForOverlay/);
  assert.match(controller, /workspace_changed/);
  assert.match(controller, /stale_target/);
});
