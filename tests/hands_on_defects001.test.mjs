import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  RANGE_CARD_REMOVAL_PROJECTION_VERSION,
  projectPreflopHandClassesAfterCardRemoval,
} from '../app/src/application/range-card-removal.mjs';
import {
  personalStrategyActionLabelKey,
  personalStrategyReasonLabelKey,
  personalStrategyStatusLabelKey,
} from '../app/src/application/personal-strategy-presentation.mjs';
import { SAVED_TUTORIAL_DEFINITION } from '../app/src/tutorial/saved-tutorial.mjs';

import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, the cascade, Matrix/range comparison, Hand
// actions, Replay and Training guards in the running app). Bootstrap,
// prepaint, renderer and translation sources are outside this ticket.
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const probe = (html) => {
  const host = markup.createElement('div');
  host.innerHTML = html;
  markup.body.appendChild(host);
  return host.firstElementChild;
};
const [authBootstrap, homeGameBootstrap, prepaint, productTranslations,
  accountTranslations, rangeTranslations, homeGameTranslations, welcomeBootstrap,
  tableRenderer, tutorialBootstrap, homeTranslations] = await Promise.all([
  readFile(new URL('../app/src/application/authentication-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/home-game-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/welcome-orientation-prepaint.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/product-translations.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/account-translations.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/range-calibration-translations.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/home-game-translations.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/welcome-orientation-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/tutorial-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8'),
]);

test('canonical card-removal projection handles zero, one, multiple, and fully removed combos', () => {
  const none = projectPreflopHandClassesAfterCardRemoval({ handClasses: ['AA', 'AKs', 'AKo'] });
  assert.equal(none.schemaVersion, RANGE_CARD_REMOVAL_PROJECTION_VERSION);
  assert.deepEqual(none.cells.AA, {
    handClass: 'AA', physicalComboCount: 6, eligibleComboCount: 6,
    blockedComboCount: 0, fullyRemoved: false, firstEligibleCombo: ['As', 'Ah'],
  });
  assert.equal(none.cells.AKs.eligibleComboCount, 4);
  assert.equal(none.cells.AKo.eligibleComboCount, 12);

  const one = projectPreflopHandClassesAfterCardRemoval({ handClasses: ['AA', 'AKs'], blockers: ['As'] });
  assert.equal(one.cells.AA.eligibleComboCount, 3);
  assert.equal(one.cells.AKs.eligibleComboCount, 3);

  const multiple = projectPreflopHandClassesAfterCardRemoval({ handClasses: ['AA'], blockers: ['As', 'Ah'] });
  assert.equal(multiple.cells.AA.eligibleComboCount, 1);
  assert.equal(multiple.cells.AA.blockedComboCount, 5);

  const removed = projectPreflopHandClassesAfterCardRemoval({
    handClasses: ['AA'], blockers: ['As', 'Ah', 'Ad', 'Ac'],
  });
  assert.equal(removed.cells.AA.eligibleComboCount, 0);
  assert.equal(removed.cells.AA.fullyRemoved, true);
  assert.equal(removed.cells.AA.firstEligibleCombo, null);
  assert.equal(Object.isFrozen(removed), true);
  assert.equal(Object.isFrozen(removed.cells.AA), true);
});

test('board and dead-card blockers share the canonical projection without a second removal rule', () => {
  const projection = projectPreflopHandClassesAfterCardRemoval({
    handClasses: ['AKs', 'AKo', 'QQ'],
    blockers: ['As', 'Kh', 'Qd'],
  });
  assert.deepEqual(projection.blockers, ['Qd', 'Kh', 'As']);
  assert.equal(projection.cells.AKs.eligibleComboCount, 2);
  assert.equal(projection.cells.AKo.eligibleComboCount, 7);
  assert.equal(projection.cells.QQ.eligibleComboCount, 3);
  assert.throws(
    () => projectPreflopHandClassesAfterCardRemoval({ handClasses: ['AA', 'AA'] }),
    /duplicates/,
  );
});

test('Matrix and range comparison consume the same Range Core projection with role-correct blockers', async () => {
  // One page-level projection helper; legacy combo/range conditioning is gone.
  assert.equal(app.evaluate('typeof projectHandClassesAfterCardRemoval'), 'function');
  for (const name of ['getFirstValidCombo', 'getValidComboForRange', 'conditionHoldemRange']) assert.equal(app.evaluate(`typeof ${name}`), 'undefined', name);
  await app.navigate('analyze');
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  await app.pickCards('#gtoMode [data-card-set-edit="dead"]', ['Ah', 'Ad', 'Ac']);
  const spy = app.spy(['projectHandClassesAfterCardRemoval']);
  try {
    // Matrix (preflop): known board and dead cards remove combos.
    const preflop = app.window.app.decisionContext;
    app.evaluate('app.matrixModel = null');
    app.call('renderChart');
    const matrixCall = spy.calls.projectHandClassesAfterCardRemoval.at(-1);
    assert.deepEqual(matrixCall?.[1], [...preflop.board, ...preflop.deadCards]);
  } finally {
    spy.restore();
  }
  // A fully removed class (AA after three dead aces) says so.
  app.evaluate('app.matrixModel = null');
  app.call('renderChart');
  const aa = app.$$('#strategyGrid .hand-cell')[0];
  assert.match(aa.getAttribute('aria-label') || aa.title || text(aa) || '', /Unavailable after known-card removal/);
  // Range comparison (needs a flop): Hero's own cards additionally block the
  // villain range.
  await app.pickCards('#gtoMode [data-card-set-edit="board"]', ['Qh', 'Jh', '2c']);
  const flop = app.window.app.decisionContext;
  const comparison = app.spy(['projectHandClassesAfterCardRemoval']);
  try {
    app.call('renderRangeAdvantage');
    const blockerSets = comparison.calls.projectHandClassesAfterCardRemoval.map(([, blockers]) => blockers);
    const common = [...flop.board, ...flop.deadCards];
    assert.deepEqual(blockerSets, [common, [...common, ...flop.heroCards]]);
  } finally {
    comparison.restore();
  }
  // The Range Core bridge installs before the classic runtime.
  const scripts = markup.querySelectorAll('script[src]');
  const bridge = scripts.find((script) => script.getAttribute('src').endsWith('range-card-removal-bootstrap.mjs'));
  const logicScript = scripts.find((script) => script.getAttribute('src').split('?')[0] === 'src/core/logic.js');
  assert.ok(precedes(bridge, logicScript));
});

test('Personal Strategy exposes only the accepted stable vocabulary and human-readable fallbacks', () => {
  const expected = new Map([
    ['directly_known', 'Specified'], ['inferred_high', 'Supported'],
    ['transferred', 'Supported'], ['inferred_medium', 'Tentative'],
    ['uncertain', 'Tentative'], ['unknown', 'Unknown'], ['conflicting', 'Conflict'],
  ]);
  for (const [status, label] of expected) assert.equal(personalStrategyStatusLabelKey(status), label);
  assert.equal(personalStrategyStatusLabelKey('future_internal_enum'), 'Unknown');
  assert.equal(personalStrategyReasonLabelKey('sparse_region'), 'Sparse evidence in this region');
  assert.equal(personalStrategyReasonLabelKey('future_reason_code'), 'Additional supporting evidence');
  assert.equal(personalStrategyActionLabelKey('explore_sparse_region'), 'Explore this region');
  for (const label of [...expected.values(), personalStrategyReasonLabelKey('future_reason_code')]) {
    assert.doesNotMatch(label, /_/);
  }
});

test('welcome, Home Game, action, Analyze, Replay, and Training repairs retain accessible structure', async () => {
  assert.match(prepaint, /classList\.remove\('active'\)/);
  assert.match(prepaint, /setAttribute\('aria-current', 'false'\)/);
  const homeGameStatus = markup.getElementById('homeGameActionStatus');
  assert.equal(homeGameStatus.getAttribute('role'), 'status');
  assert.equal(homeGameStatus.getAttribute('aria-live'), 'polite');
  assert.match(homeGameBootstrap, /home-game-completion-state/);
  assert.match(homeGameBootstrap, /Session completed/);
  assert.match(homeGameBootstrap, /read-only and remains available in Recent Sessions/);

  // Hand actions: a label plus an LTR poker-data amount that inherits the font.
  await app.startHand(['As', 'Kd']);
  const call = app.$('[data-canonical-action="call"]');
  const label = call.querySelector('.hand-action-label');
  const amount = call.querySelector('.hand-action-amount.poker-data-token');
  assert.ok(label && amount);
  assert.equal(amount.getAttribute('dir'), 'ltr');
  for (const node of [label, amount]) {
    for (const property of ['font', 'font-size']) {
      assert.equal(css.cascaded(node, property), css.cascaded(call, property), `${node.className} ${property} is inherited`);
    }
  }
  const panel = probe('<div class="analysis-panel-content"></div>');
  assert.equal(css.cascaded(panel, 'max-block-size'), 'min(420px, 44vh)');
  assert.equal(css.cascaded(panel, 'overflow'), 'auto');
  assert.notEqual(css.cascaded(probe('<div class="matrix-tooltip"></div>'), 'max-height'), '76px');

  // Hand play and review share one table width. (Superseded literal: the
  // --table-inline-max cap was replaced by a later rule that fills the Hand
  // table region; play and review still match.)
  const gto = app.byId('gtoMode');
  const wrapper = app.byId('table-wrapper');
  const table = app.byId('visual-table-container');
  const previous = wrapper.dataset.tableProjection;
  assert.equal(gto.dataset.productDestination, 'hand');
  const widths = ['play', 'review'].map((projection) => {
    wrapper.dataset.tableProjection = projection;
    return [css.cascaded(table, 'inline-size'), css.cascaded(table, 'width')];
  });
  wrapper.dataset.tableProjection = previous;
  assert.deepEqual(widths[0], widths[1]);

  const start = markup.getElementById('trainingNewHand');
  assert.equal(start.dataset.i18n, 'Start Training');
  assert.equal(text(start), 'Start Training');
  assert.equal(markup.getElementById('trainingIdleStart'), null);
  assert.ok(markup.querySelector('details.training-analysis-region'));
  assert.ok(markup.querySelector('[data-training-availability="ready-to-load"]'));
  // Starting over an active session asks first and abandons the old one.
  await app.training.start('focused');
  const spy = app.spy(['startConfiguredTrainingSessionWithGuard', 'startConfiguredTrainingSession', 'finishTrainingMemorySession']);
  const confirm = app.window.confirm;
  const prompts = [];
  app.window.confirm = (message) => { prompts.push(message); return true; };
  try {
    await app.click('#trainingNewHand');
    await app.settle(500);
    assert.equal(spy.count('startConfiguredTrainingSessionWithGuard'), 1);
    assert.match(prompts[0] || '', /active session will be marked incomplete/);
    assert.equal(spy.count('startConfiguredTrainingSession'), 1);
    // Clearing an active session records it as abandoned.
    spy.reset();
    app.call('clearTrainingSessionState');
    assert.ok(spy.calls.finishTrainingMemorySession.some(([reason]) => reason === 'abandoned'));
  } finally {
    spy.restore();
    app.window.confirm = confirm;
  }
  // Grade counts style only their direct rows.
  const counts = probe('<div class="training-grade-counts"><span><i></i><span>Label</span><b>2</b></span></div>');
  const row = counts.firstElementChild;
  assert.equal(css.cascaded(row, 'grid-template-columns'), '10px minmax(0, 1fr) auto');
  assert.notEqual(css.cascaded(row.querySelector('span'), 'grid-template-columns'), '10px minmax(0, 1fr) auto');
});

test('final human-evidence correction preserves bounded visible-state contracts', async () => {
  const title = markup.getElementById('welcomeTitle');
  assert.ok(title);
  assert.equal(title.hasAttribute('tabindex'), false);
  assert.match(welcomeBootstrap, /clearNavigationSelection/);
  assert.match(welcomeBootstrap, /setAttribute\('aria-current', 'false'\)/);
  assert.doesNotMatch(welcomeBootstrap, /shell\.dataset\.(?:activeMode|activeDestination) = 'welcome'/);
  assert.doesNotMatch(welcomeBootstrap, /heading\?\.focus/);
  const root = markup.documentElement;
  const item = markup.querySelector('.mode-nav-item[aria-current="page"]');
  root.dataset.welcomeOrientation = 'visible';
  assert.equal(css.cascaded(item, 'background'), 'transparent', 'no false selected workspace behind Welcome');
  root.dataset.welcomeOrientation = 'inactive';

  assert.match(homeGameBootstrap, /home-game-completion-warning/);
  assert.match(homeGameBootstrap, /Cannot complete: session is unbalanced by \{amount\}/);
  assert.match(homeGameBootstrap, /warning\.setAttribute\('role', 'alert'\)/);
  assert.match(homeGameBootstrap, /aria-describedby', 'homeGameCompletionWarning/);
  assert.equal(css.cascaded(probe('<p class="home-game-completion-warning"></p>'), 'border-inline-start-width'), '4px');

  assert.match(tableRenderer, /const cardsAreKnown = player\.cardVisibility === 'known'/);
  assert.match(tableRenderer, /if \(cardsAreKnown\) \{[\s\S]*?seat\.append\(holeCards\)[\s\S]*?seat\.append\(dealer\)/);
  assert.match(tableRenderer, /else \{[\s\S]*?seatInfo\?\.before\(holeCards\)/);
  assert.match(tableRenderer, /player\.cardVisibility === 'hidden'[\s\S]*?renderCardBack\(0\)/);

  // Replay: the live exit is a hidden, disabled primary until Replay leaves a
  // live hand; then it returns to the endpoint.
  const liveMarkup = markup.getElementById('handReplayLiveButton');
  assert.ok(liveMarkup.classList.contains('ui-button--primary'));
  assert.equal(liveMarkup.hidden, true);
  assert.equal(liveMarkup.disabled, true);
  await app.startHand(['As', 'Kd']);
  await app.handAction('call');
  const live = app.byId('handReplayLiveButton');
  assert.equal(live.hidden, true, 'hidden while live');
  await app.click('#handReplayPreviousButton');
  await app.settle(200);
  assert.equal(live.hidden, false, 'shown once Replay leaves a live hand');
  assert.equal(live.disabled, false);
  assert.equal(text(live), 'Return to live');
  const spy = app.spy(['callPlaybookStateBridge']);
  try {
    await app.click(live);
    assert.equal(spy.calls.callPlaybookStateBridge[0][0], 'returnReplayToEndpoint');
  } finally {
    spy.restore();
  }
  await app.settle(200);
  assert.equal(live.hidden, true);

  assert.equal(SAVED_TUTORIAL_DEFINITION.id, 'saved.library');
  assert.equal(SAVED_TUTORIAL_DEFINITION.workspace, 'saved');
  assert.equal(SAVED_TUTORIAL_DEFINITION.version, 1);
  assert.doesNotMatch(JSON.stringify(SAVED_TUTORIAL_DEFINITION), /A quick tour of Home|My Riverline shows/);
  assert.match(tutorialBootstrap, /SAVED_TUTORIAL_DEFINITION/);
  assert.match(tutorialBootstrap, /activeDestination === 'saved'[\s\S]*?\? 'saved'/);
  // Guest Home states that local study does not sync.
  await app.navigate('home');
  await app.settle(300);
  assert.match(text(app.byId('homeMode')), /Saved study, Personal Strategy, and Training Memory stay on this device in Guest Mode/);
  assert.match(text(app.byId('homeMode')), /Guest data does not sync/);
  assert.match(accountTranslations, /Saved study, Personal Strategy, and Training Memory stay on this device in Guest Mode/);
});

test('auth failure and password mismatch feedback is visible, privacy-safe, localized, and assertive on error', () => {
  assert.equal(markup.getElementById('accountSignUpPasswordConfirm').getAttribute('autocomplete'), 'new-password');
  const status = markup.getElementById('accountAuthStatus');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.match(authBootstrap, /Passwords do not match/);
  assert.match(authBootstrap, /setAttribute\('role', error \? 'alert' : 'status'\)/);
  assert.match(authBootstrap, /setAttribute\('aria-live', error \? 'assertive' : 'polite'\)/);
  assert.doesNotMatch(authBootstrap, /error\.message|result\.error\.message/);

  for (const source of [productTranslations, accountTranslations, rangeTranslations, homeGameTranslations]) {
    assert.match(source, /const ru =/);
    assert.match(source, /const he =/);
  }
  for (const key of ['Passwords do not match.', 'Email or password is incorrect. For privacy, Riverline does not confirm whether an account exists.', 'Sign-in is temporarily unavailable. Check the connection and try again.']) {
    assert.ok(accountTranslations.includes(`'${key}'`), key);
  }
  for (const key of ['Specified', 'Supported', 'Tentative', 'Unknown', 'Conflict']) {
    assert.ok(rangeTranslations.includes(`'${key}'`), key);
  }
  assert.ok(productTranslations.includes("'Start a new Training session? The active session will be marked incomplete, and its recorded decisions will remain in Training Memory.'"));
  assert.ok(homeGameTranslations.includes("'Session completed'"));
});
