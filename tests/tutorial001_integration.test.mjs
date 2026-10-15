import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

import { appStyleSheet, bootApp, indexDocument } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, cascade on the rendered coach mark, running app).
// Tutorial module sources are outside this ticket and keep their checks.
const [bootstrap, controller, anchors, coach, translations] = await Promise.all([
  readFile(new URL('../app/src/application/tutorial-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/tutorial/controller.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/tutorial/anchors.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/tutorial/coach-mark.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/tutorial-translations.js', import.meta.url), 'utf8'),
]);
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const tutorials = app.window.RiverlineTutorials;

async function startHomeTutorial() {
  await app.navigate('home');
  tutorials.start('home.first-use');
  await app.settle(200);
  assert.equal(tutorials.getState().status, 'active');
}

test('Home exposes stable semantic anchors and one consistent manual restart action', async () => {
  // Protects: Home/shell anchors exist; step 1 spotlights the session panel
  // that is shown (guest panel for guests, account overview when signed in);
  // the header Help control; navigation notifies and offers tutorials.
  for (const anchor of ['home-overview', 'home-recent', 'home-review', 'home-study-inbox', 'shell-navigation']) {
    assert.ok(markup.querySelector(`[data-tutorial-anchor="${anchor}"]`), anchor);
  }
  assert.equal(markup.getElementById('homeGuestAccount').dataset.tutorialAnchor, 'home-overview');
  assert.equal(markup.getElementById('studyInboxPanel').dataset.tutorialAnchor, 'home-study-inbox');
  assert.equal(markup.querySelector('.mode-navigation').dataset.tutorialAnchor, 'shell-navigation');
  assert.equal(markup.querySelector('[data-tutorial-anchor="home-quick-start"]'), null);
  assert.equal(markup.getElementById('workspaceTutorialButton').getAttribute('aria-label'), 'Help');

  // QA-SWEEP-013: step 1 spotlights the shown session panel, never the header.
  const overviewIs = (panel) => {
    const anchored = app.$$('[data-tutorial-anchor="home-overview"]');
    return anchored.length === 1 && anchored[0] === panel;
  };
  assert.ok(overviewIs(app.byId('homeGuestAccount')));
  const model = app.evaluate('homeViewModel');
  assert.ok(model, 'Home rendered a view model');
  try {
    app.call('renderHomeWorkspace', { ...model, sessionMode: 'signed_in' });
    assert.ok(overviewIs(app.byId('homeAccountOverview')), 'signed-in users get the account overview');
  } finally {
    app.call('renderHomeWorkspace', model);
  }
  assert.ok(overviewIs(app.byId('homeGuestAccount')));

  const changed = [];
  const offered = [];
  const originalChanged = tutorials.workspaceChanged;
  const originalOffer = tutorials.offerForWorkspace;
  const spyTarget = Object.create(tutorials, {
    workspaceChanged: { value: (...args) => { changed.push(args[0]); return originalChanged(...args); } },
    offerForWorkspace: { value: (...args) => { offered.push(args[0]); return originalOffer(...args); } },
  });
  Object.defineProperty(app.window, 'RiverlineTutorials', { value: spyTarget, configurable: true, writable: true });
  try {
    await app.navigate('equity');
  } finally {
    Object.defineProperty(app.window, 'RiverlineTutorials', { value: tutorials, configurable: true, writable: true });
  }
  assert.ok(changed.includes('equity'));
  assert.ok(offered.includes('equity'));
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

test('overlay uses design tokens, viewport bounds, RTL-safe logical properties, and reduced motion', async () => {
  // Protects: the overlay layer uses the tutorial z-index token (90); the
  // coach uses elevated surface tokens and is bounded by the viewport (tighter
  // under 1100px wide or 800px tall); actions use logical inline spacing; the
  // spotlight and coach do not transition under reduced motion.
  assert.equal(css.cascaded(app.document.documentElement, '--z-tutorial'), '90');
  await startHomeTutorial();
  const layer = app.$('.tutorial-layer');
  const coachMark = app.$('.tutorial-coach');
  const spotlight = app.$('.tutorial-spotlight');
  assert.ok(layer && coachMark && spotlight, 'the coach mark is rendered');
  assert.equal(css.resolved(layer, 'z-index'), '90');
  assert.match(css.cascaded(coachMark, 'background'), /var\(--surface-elevated\)/);
  assert.match(css.cascaded(coachMark, 'max-height'), /^calc\(100dvh - /);
  for (const environment of [{ width: 1000 }, { width: 1920, height: 760 }]) {
    assert.equal(css.cascaded(coachMark, 'max-height', environment), 'calc(100dvh - (var(--space-5) * 2))');
  }
  const back = coachMark.querySelector('.tutorial-actions [data-tutorial-action="back"]');
  if (back) assert.equal(css.cascaded(back, 'margin-inline-end'), 'auto');
  assert.ok(css.cascaded(coachMark.querySelector('.tutorial-actions'), 'margin-block-start'));
  for (const node of [spotlight, coachMark]) {
    assert.equal(css.cascaded(node, 'transition', { reducedMotion: true }), 'none');
  }
  assert.match(coach, /prefers-reduced-motion: reduce/);
  assert.match(coach, /behavior: reduced \? 'auto' : 'smooth'/);
  tutorials.cancel?.('test_cleanup');
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

test('tutorial foundation is isolated from poker, strategy, Equity, Training, Replay, and SavedStudyObject authorities', async () => {
  const foundation = `${controller}\n${anchors}\n${coach}`;
  assert.doesNotMatch(foundation, /StrategyProvider|resolveStrategy|DecisionContext|SavedStudyObject|indexedDB|Equity|Training|Replay|poker-domain/);
  assert.doesNotMatch(bootstrap, /from ['"][^'"]*(?:strategy|equity|training|replay|saved-study|poker-domain)/i);
  // Protects: opening an overlay (the card picker) cancels an active tutorial.
  await startHomeTutorial();
  await app.navigate('analyze');
  if (tutorials.getState().status !== 'active') {
    tutorials.start('playbook.scenario-basics');
    await app.settle(200);
  }
  assert.equal(tutorials.getState().status, 'active');
  await app.click('#gtoMode [data-card-set-edit="hero"]');
  assert.notEqual(tutorials.getState().status, 'active', 'the card picker cancels the tutorial');
  app.call('closePicker');
  assert.match(controller, /workspace_changed/);
  assert.match(controller, /stale_target/);
});
