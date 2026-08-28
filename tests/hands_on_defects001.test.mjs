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

const [html, css, logic, authBootstrap, homeGameBootstrap, prepaint, productTranslations,
  accountTranslations, rangeTranslations, homeGameTranslations, welcomeBootstrap,
  tableRenderer, tutorialBootstrap, homeTranslations] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
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

test('Matrix and range comparison consume the same Range Core projection with role-correct blockers', () => {
  assert.equal((logic.match(/function projectHandClassesAfterCardRemoval\(/g) || []).length, 1);
  assert.doesNotMatch(logic, /function get(?:FirstValidCombo|ValidComboForRange)\(/);
  assert.doesNotMatch(logic, /conditionHoldemRange/);
  assert.match(logic, /projectHandClassesAfterCardRemoval\(\s*handClasses,\s*\[\.\.\.decisionContext\.board, \.\.\.decisionContext\.deadCards\]/);
  assert.match(logic, /const commonBlockers = \[\.\.\.decisionContext\.board, \.\.\.decisionContext\.deadCards\]/);
  assert.match(logic, /projectHandClassesAfterCardRemoval\(\s*\[\.\.\.villainRange\],\s*\[\.\.\.commonBlockers, \.\.\.decisionContext\.heroCards\]/);
  assert.match(logic, /Unavailable after known-card removal/);
  assert.match(html, /range-card-removal-bootstrap\.mjs[\s\S]*src\/core\/logic\.js/);
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

test('welcome, Home Game, action, Analyze, Replay, and Training repairs retain accessible structure', () => {
  assert.match(prepaint, /classList\.remove\('active'\)/);
  assert.match(prepaint, /setAttribute\('aria-current', 'false'\)/);
  assert.match(html, /id="homeGameActionStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(homeGameBootstrap, /home-game-completion-state/);
  assert.match(homeGameBootstrap, /Session completed/);
  assert.match(homeGameBootstrap, /read-only and remains available in Recent Sessions/);

  assert.match(logic, /hand-action-label/);
  assert.match(logic, /hand-action-amount poker-data-token/);
  assert.match(logic, /amount\.dir = 'ltr'/);
  assert.match(css, /\.hand-action-dock :is\(\.hand-action-label, \.hand-action-amount\)[\s\S]*font:\s*inherit/);
  assert.match(css, /\.analysis-panel-content\s*\{[^}]*max-block-size:\s*none[^}]*overflow:\s*visible/);
  assert.doesNotMatch(css, /\.matrix-tooltip\s*\{[^}]*max-height:\s*76px/);

  assert.match(css, /data-table-projection="play"[^}]*\{[^}]*var\(--table-inline-max\)/);
  assert.match(css, /data-table-projection="review"[^}]*\{[^}]*var\(--table-inline-max\)/);
  assert.match(html, /id="trainingNewHand"[^>]+data-i18n="Start Training"[^>]*>Start Training/);
  assert.doesNotMatch(html, /id="trainingIdleStart"/);
  assert.match(html, /<details class="training-analysis-region"/);
  assert.match(html, /data-training-availability="ready-to-load"/);
  assert.match(logic, /function startConfiguredTrainingSessionWithGuard/);
  assert.match(logic, /finishTrainingMemorySession\('abandoned'\)/);
  assert.match(css, /\.training-grade-counts\s*>\s*span/);
  assert.doesNotMatch(css, /\.training-grade-counts span\s*\{/);
});

test('final human-evidence correction preserves bounded visible-state contracts', () => {
  const welcome = html.slice(html.indexOf('id="welcomeOrientation"'), html.indexOf('class="shell workspace-canvas"'));
  assert.doesNotMatch(welcome, /id="welcomeTitle"[^>]+tabindex/);
  assert.match(welcomeBootstrap, /clearNavigationSelection/);
  assert.match(welcomeBootstrap, /setAttribute\('aria-current', 'false'\)/);
  assert.match(welcomeBootstrap, /shell\.dataset\.activeMode = 'welcome'/);
  assert.doesNotMatch(welcomeBootstrap, /heading\?\.focus/);
  assert.match(css, /data-welcome-orientation="visible"[\s\S]*?\.mode-nav-item[\s\S]*?background:\s*transparent/);

  assert.match(homeGameBootstrap, /home-game-completion-warning/);
  assert.match(homeGameBootstrap, /Cannot complete: session is unbalanced by \{amount\}/);
  assert.match(homeGameBootstrap, /warning\.setAttribute\('role', 'alert'\)/);
  assert.match(homeGameBootstrap, /aria-describedby', 'homeGameCompletionWarning/);
  assert.match(css, /\.home-game-completion-warning[\s\S]*?border-inline-start-width:\s*4px/);

  assert.match(tableRenderer, /const cardsAreKnown = player\.cardVisibility === 'known'/);
  assert.match(tableRenderer, /if \(cardsAreKnown\) \{[\s\S]*?seat\.append\(holeCards\)[\s\S]*?seat\.append\(dealer\)/);
  assert.match(tableRenderer, /else \{[\s\S]*?seatInfo\?\.before\(holeCards\)/);
  assert.match(tableRenderer, /player\.cardVisibility === 'hidden'[\s\S]*?renderCardBack\(0\)/);

  assert.match(html, /id="handReplayLiveButton"[^>]+ui-button--primary[^>]+hidden[^>]+disabled/);
  assert.match(logic, /const canExitReplayToLive = projection\.mode === 'replay'/);
  assert.match(logic, /projection\.canReturnToLive === true/);
  assert.match(logic, /liveState\.terminal\?\.isTerminal !== true/);
  assert.match(logic, /live\.hidden = !canExitReplayToLive/);
  assert.match(logic, /callPlaybookStateBridge\('returnReplayToEndpoint'\)/);

  assert.equal(SAVED_TUTORIAL_DEFINITION.id, 'saved.library');
  assert.equal(SAVED_TUTORIAL_DEFINITION.workspace, 'saved');
  assert.equal(SAVED_TUTORIAL_DEFINITION.version, 1);
  assert.doesNotMatch(JSON.stringify(SAVED_TUTORIAL_DEFINITION), /A quick tour of Home|My Riverline shows/);
  assert.match(tutorialBootstrap, /SAVED_TUTORIAL_DEFINITION/);
  assert.match(tutorialBootstrap, /activeDestination === 'saved'[\s\S]*?\? 'saved'/);
  assert.match(logic, /Saved study belongs to a signed-in Riverline profile/);
  assert.match(logic, /Signing in does not enable sync or cloud backup/);
  assert.match(homeTranslations, /Saved study belongs to a signed-in Riverline profile/);
});

test('auth failure and password mismatch feedback is visible, privacy-safe, localized, and assertive on error', () => {
  assert.match(html, /id="accountSignUpPasswordConfirm"[^>]+autocomplete="new-password"/);
  assert.match(html, /id="accountAuthStatus"[^>]+role="status"[^>]+aria-live="polite"/);
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
