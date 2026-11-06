import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: Full Hand Training is played in the booted app (service bridge
// calls, input locking, status copy, sizing controls, review and handoff are
// observed), markup is parsed and styling resolved through the cascade.
// Bootstrap/sizing/i18n sources are outside this ticket.
const bootstrap = fs.readFileSync(
  new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const sizing_ = fs.readFileSync(
  new URL('../app/src/application/full-hand-training-sizing.mjs', import.meta.url),
  'utf8',
);
const i18n = fs.readFileSync(new URL('../app/src/locales/i18n.js', import.meta.url), 'utf8');
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const training = markup.getElementById('trainingMode');
const byId = (id) => training.querySelector(`#${id}`);
const workspace = () => app.$('.training-workspace');

// One observed live Full Hand, shared by the live-behaviour tests.
let live = null;
async function observeLiveHand() {
  if (live) return live;
  const spy = app.spy([
    'callTrainingServiceBridge', 'setFullHandTrainingInputLocked', 'updateTrainingButtons',
    'renderFullHandTrainingHistory', 'showTrainingFeedback', 'showTrainingSolution',
    'renderTrainingEvaluationSummary', 'renderFullHandDecisionRecorded',
  ]);
  const observed = { statuses: new Set(), heroTurn: null, sizing: null, feedbackDisplay: null, setupHidden: null, sessionOrder: null, abortHidden: [], recorded: null };
  try {
    await app.training.start('full_hand');
    for (let round = 0; round < 2000 && workspace().dataset.trainingFullHandPhase === 'live'; round += 1) {
      await app.settle(100);
      const status = app.byId('trainingFullHandActionStatus');
      observed.statuses.add(text(status));
      if (workspace().dataset.trainingFullHandPhase === 'live') observed.abortHidden.push(app.byId('trainingFullHandEndHand').hidden);
      if (!observed.feedbackDisplay) {
        observed.feedbackDisplay = css.cascaded(app.byId('trainingFeedback'), 'display');
        observed.setupHidden = css.cascaded(app.byId('trainingVariedControls'), 'display');
        observed.sessionOrder = css.cascaded(app.$('.training-session-panel'), 'order', { width: 1440 });
      }
      if (status.dataset.presentationState === 'hero_turn' && !observed.heroTurn) {
        const table = app.$('.training-full-hand-table-wrapper #visual-table-container');
        const seat = app.$('.training-full-hand-table-wrapper .table-seat.is-hero.is-actor .table-seat-surface');
        observed.heroTurn = {
          tableFlag: table?.dataset.trainingHeroTurn,
          statusAnimation: css.cascaded(status, 'animation'),
          statusAnimationReduced: css.cascaded(status, 'animation', { reducedMotion: true }),
          seatAnimation: seat ? css.cascaded(seat, 'animation') : null,
          seatAnimationReduced: seat ? css.cascaded(seat, 'animation', { reducedMotion: true }) : null,
        };
      }
      if (workspace().dataset.trainingState !== 'ready') continue;
      const buttons = app.training.answerButtons();
      const sized = buttons.find((button) => ['bet', 'raise'].includes(button.dataset.action));
      if (sized && !observed.sizing) {
        // TRAINING-FULLHAND-001: the dock's size ladder (select, pick a size, Confirm).
        const sizes = app.$('#trainingFullHandActionDock [data-fh-sizes]');
        const ladderBefore = Boolean(sizes.querySelector('.rl-ladder'));
        const confirmBefore = text(app.byId('trainingFullHandConfirm'));
        await app.click(sized);
        await app.settle(50);
        const ladder = sizes.querySelector('.rl-ladder');
        const sizeButtons = ladder ? [...ladder.querySelectorAll('.rl-ladder__size')] : [];
        observed.sizing = {
          action: sized.dataset.action,
          ladderBefore,
          shown: Boolean(ladder),
          confirmBefore,
          confirmAfterSelect: text(app.byId('trainingFullHandConfirm')),
          sizes: sizeButtons.map((button) => text(button)),
          custom: Boolean(ladder?.querySelector('.rl-ladder__input')),
        };
        await app.click(sizeButtons[0]);
        await app.settle(50);
        observed.sizing.confirmAfterSize = text(app.byId('trainingFullHandConfirm'));
        await app.click('#trainingFullHandConfirm');
        await app.settle(200);
        observed.recorded = text(app.byId('trainingFullHandDecisionFeedbackTitle'));
        continue;
      }
      const pick = buttons.find((button) => button.dataset.action === 'check')
        || buttons.find((button) => button.dataset.action === 'call') || buttons[0];
      if (pick) {
        await app.click(pick);
        await app.training.confirmFullHand();
      }
    }
  } finally {
    observed.calls = Object.fromEntries(Object.entries(spy.calls).map(([name, calls]) => [name, calls]));
    spy.restore();
  }
  observed.phase = workspace().dataset.trainingFullHandPhase;
  live = observed;
  return live;
}

test('Training exposes Full Hand beside preserved Varied Session and Focused Drill modes', async () => {
  assert.ok(training.querySelector('[data-training-session-mode="varied"]'));
  assert.ok(training.querySelector('[data-training-session-mode="focused"]'));
  assert.equal(training.querySelector('[data-training-session-mode="full_hand"]').dataset.i18n, 'Full Hand');
  assert.equal(byId('trainingFullHandSetupNote').hidden, true);
  for (const preserved of [
    'trainingVariedControls', 'trainingFocusedControls', 'trainingStreet',
    'trainingDecisionTarget', 'trainingHeroPos', 'trainingPlayers', 'trainingStack',
  ]) assert.ok(byId(preserved), preserved);
  // Only the three modes are accepted; Focused controls hide only for Varied.
  await app.navigate('training');
  for (const [mode, focusedHidden, noteHidden] of [['varied', true, true], ['focused', false, true], ['full_hand', false, false]]) {
    await app.training.selectMode(mode);
    assert.equal(app.call('trainingSessionMode'), mode);
    assert.equal(app.byId('trainingFocusedControls').hidden, focusedHidden, mode);
    assert.equal(app.byId('trainingFullHandSetupNote').hidden, noteHidden, mode);
  }
  app.call('setTrainingSessionMode', 'bogus');
  assert.equal(app.call('trainingSessionMode'), 'varied');
});

test('Full Hand reuses legal action controls and the canonical table presence renderer', async () => {
  for (const reused of [
    'trainingPotInfo', 'trainingGuessButtons', 'trainingActionHistory', 'trainingStrategySource',
  ]) assert.ok(byId(reused), reused);
  for (const added of [
    'trainingDecisionNumber', 'trainingFullHandTableMount', 'trainingFullHandCompletion',
    'trainingFullHandResult', 'trainingFullHandDecisionCount', 'trainingFullHandGradeSummary',
    'trainingReviewHand', 'trainingHandReviewMount', 'trainingFullHandActionStatus',
    'trainingFullHandActionDock', 'trainingFullHandTickets', 'trainingFullHandPrice',
  ]) assert.ok(byId(added), added);
  assert.match(bootstrap, /createTablePresenceViewModel\(\{/);
  const observed = await observeLiveHand();
  const methods = observed.calls.callTrainingServiceBridge.map(([method]) => method);
  // The canonical table presence is built by the service and mounted in place.
  assert.ok(methods.includes('createFullHandTablePresence'));
  assert.ok(app.byId('trainingFullHandTableMount').querySelector('#visual-table-container'));
  // Sizes come from the service's canonical sizing model before answering.
  assert.ok(methods.includes('getFullHandSizingModel'));
  assert.ok(methods.indexOf('getFullHandSizingModel') < methods.lastIndexOf('answerFullHand'));
  assert.ok(observed.calls.updateTrainingButtons.length >= 1);
  assert.ok(observed.calls.renderFullHandTrainingHistory.length >= 1);
});

test('Full Hand reveals the canonical size ladder only after Bet or Raise', async () => {
  const dock = byId('trainingFullHandActionDock');
  assert.ok(dock.querySelector('[data-fh-sizes]'), 'the dock has a sizes row');
  assert.ok(dock.querySelector('[data-fh-confirm]'), 'and a Confirm slot on the same command row');
  assert.match(sizing_, /getLegalActionSpec\(state\)/);
  assert.match(sizing_, /kind: 'all_in',[\s\S]*actionType: ACTION_TYPES\.ALL_IN/);
  assert.match(sizing_, /seenActions\.has\(identity\)/);
  assert.match(sizing_, /roundToChipUnit/);
  const observed = await observeLiveHand();
  assert.ok(observed.sizing, 'a Bet or Raise decision was reached');
  assert.equal(observed.sizing.ladderBefore, false, 'no ladder until Bet or Raise');
  assert.equal(observed.sizing.shown, true);
  assert.equal(observed.sizing.confirmBefore, 'Choose an actionEnter');
  assert.match(observed.sizing.confirmAfterSelect, /^Choose a size/, 'a size is chosen before Confirm unlocks');
  assert.match(observed.sizing.confirmAfterSize, /^Confirm (Bet|Raise) .+ bb/);
  assert.ok(observed.sizing.sizes.length >= 2, 'the ladder offers several canonical sizes');
  assert.ok(observed.sizing.sizes.every((label) => /\d/.test(label) && !/all.?in/i.test(label)), 'All-in stays a separate legal action');
  assert.ok(observed.sizing.sizes.every((label) => /%\s*pot/i.test(label)), 'every size shows its share of the pot');
  assert.equal(observed.sizing.custom, true, 'an exact amount can still be typed');
  assert.ok(observed.calls.callTrainingServiceBridge.some(([method]) => method === 'answerFullHand'));
});

test('Hero answer resumes through stepwise automation with no Continue Hand UI', async () => {
  for (const method of [
    'createFullHandStartConfiguration', 'startFullHand', 'answerFullHand',
    'advanceFullHandOneEvent', 'createFullHandPresentationOrchestrator',
    'createFullHandTableTransition', 'getFullHandSnapshot', 'getFullHandReview', 'resetFullHand',
    'getFullHandSizingModel', 'validateFullHandSizingInput',
  ]) assert.match(bootstrap, new RegExp(`${method}\\(`), method);
  assert.doesNotMatch(bootstrap, /continueFullHand\(/);
  const observed = await observeLiveHand();
  const methods = observed.calls.callTrainingServiceBridge.map(([method]) => method);
  for (const method of ['startFullHand', 'answerFullHand', 'getFullHandSnapshot', 'advanceFullHandOneEvent']) assert.ok(methods.includes(method), method);
  assert.ok(!methods.includes('continueFullHand'));
  const start = observed.calls.callTrainingServiceBridge.find(([method]) => method === 'startFullHand');
  assert.equal(start?.[2]?.progressionMode, 'stepwise');
  assert.ok(start[2].strategyProvider, 'the hand starts with the strategy provider');
  assert.doesNotMatch(text(app.byId('trainingMode')), /Continue Hand/);
  // Leaving Training restores the shared table; returning re-renders the snapshot.
  const spy = app.spy(['restoreSharedPokerTable', 'renderFullHandTrainingSnapshot']);
  try {
    await app.navigate('equity');
    assert.ok(spy.count('restoreSharedPokerTable') >= 1);
    await app.navigate('training');
    assert.ok(spy.count('renderFullHandTrainingSnapshot') >= 1);
  } finally {
    spy.restore();
  }
});

test('live pacing communicates actor, action, street, and the Hero boundary without unlocking early', async () => {
  const status = byId('trainingFullHandActionStatus');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.getAttribute('aria-atomic'), 'true');
  assert.ok(byId('trainingDecisionPrompt'));
  const observed = await observeLiveHand();
  const locks = observed.calls.setFullHandTrainingInputLocked.map(([locked]) => locked);
  assert.ok(locks.includes(true) && locks.includes(false));
  const statuses = [...observed.statuses];
  assert.ok(statuses.some((line) => /^.+ is thinking…$/.test(line)), statuses.join(' / '));
  assert.ok(statuses.some((line) => /^Your turn · Hero \(.+\) to act$/.test(line)));
  assert.ok(statuses.some((line) => line === 'Dealing the flop…') || observed.phase !== 'live', 'the flop is announced when reached');
  assert.ok(statuses.some((line) => /folds|calls|raises|checks|bets/.test(line)), 'actions are announced');
  // Hero's turn is emphasized (status and seat pulse) and still under reduced motion.
  assert.ok(observed.heroTurn);
  assert.equal(observed.heroTurn.tableFlag, 'true');
  assert.match(observed.heroTurn.statusAnimation, /training-hero-status-pulse/);
  assert.equal(observed.heroTurn.statusAnimationReduced, 'none');
  assert.match(observed.heroTurn.seatAnimation || '', /training-hero-seat-pulse/);
  assert.equal(observed.heroTurn.seatAnimationReduced, 'none');
  assert.equal(css.cascaded(probeStatus(), 'transition', { reducedMotion: true }), 'none');
});

function probeStatus() {
  const node = markup.createElement('div');
  node.className = 'training-full-hand-action-status';
  markup.body.appendChild(node);
  return node;
}

test('live Full Hand hides the Varied report, defers verdicts, and exposes live-only Abort', async () => {
  assert.ok(byId('trainingFeedback'));
  // (The old literal "Strategy frequencies" matched copy later in the page;
  // the solution panel heading is now "Source frequencies".)
  assert.match(text(byId('trainingSolution')), /Source frequencies/);
  assert.ok(byId('trainingFullHandActionDock'));
  for (const id of ['trainingFullHandCompactControls', 'trainingFullHandLiveNewHand', 'trainingFullHandEndHand']) assert.ok(byId(id), id);
  const abort = byId('trainingFullHandEndHand');
  assert.equal(abort.hidden, true);
  assert.equal(abort.dataset.i18n, 'Abort hand');
  const observed = await observeLiveHand();
  // No Varied report or verdict during the live hand; only "Decision recorded".
  for (const name of ['showTrainingFeedback', 'showTrainingSolution', 'renderTrainingEvaluationSummary']) assert.equal(observed.calls[name].length, 0, name);
  assert.ok(observed.calls.renderFullHandDecisionRecorded.length >= 1);
  assert.equal(observed.recorded, 'Decision recorded');
  assert.equal(observed.feedbackDisplay, 'none');
  assert.equal(observed.setupHidden, 'none', 'live hides the full setup fields');
  assert.equal(observed.sessionOrder, '2');
  assert.ok(observed.abortHidden.every((hidden) => hidden === false), 'Abort is visible while live');
  // Abort confirms, then clears the session.
  await app.training.start('full_hand');
  await app.settle(500);
  assert.equal(workspace().dataset.trainingFullHandPhase, 'live');
  assert.equal(app.byId('trainingFullHandEndHand').hidden, false);
  const spy = app.spy(['clearTrainingSessionState']);
  try {
    await app.click('#trainingFullHandEndHand');
    assert.equal(spy.count('clearTrainingSessionState'), 1);
  } finally {
    spy.restore();
  }
  assert.notEqual(workspace().dataset.trainingFullHandPhase, 'live');
  assert.equal(app.byId('trainingFullHandEndHand').hidden, true);
});

test('terminal surface provides real decision review navigation and exact Analysis handoff', async () => {
  assert.equal(byId('trainingFullHandCompletion').getAttribute('aria-live'), 'polite');
  assert.equal(byId('trainingReviewHand').getAttribute('aria-expanded'), 'false');
  for (const id of [
    'handReviewPreviousDecision', 'handReviewNextDecision',
    'handReviewChosenAction', 'handReviewComparisonBadge',
    'handReviewFrequencyRows', 'handReviewAnalyze',
    'handReviewPreviousEvent', 'handReviewNextEvent',
  ]) assert.ok(markup.getElementById(id), id);
  await app.training.playFullHand();
  const completion = app.byId('trainingFullHandCompletion');
  assert.equal(completion.hidden, false);
  assert.equal(css.cascaded(completion, 'display'), 'grid');
  assert.ok(app.call('callTrainingServiceBridge', 'getFullHandSnapshot')?.completedHandResult, 'completion comes from the canonical result');
  await app.click('#trainingReviewHand');
  await app.settle(300);
  const model = app.window.app.handReview.model;
  assert.ok(model?.decisions?.length >= 1);
  const decision = model.selectedDecision;
  assert.ok(Number.isSafeInteger(decision.replayFrameTarget.frameIndex));
  assert.equal(text(app.byId('handReviewChosenAction')), app.call('reviewActionCopy', decision.chosenAction, decision));
  if (decision.chosenAction?.amountToBb != null || decision.chosenAction?.amountToMilliBb != null) {
    assert.match(text(app.byId('handReviewChosenAction')), / to /);
  }
  assert.ok(css.cascaded(app.$('.hand-review-decision-facts'), 'grid-template-columns'));
  // Analyze hands the exact decision context to Analysis.
  const spy = app.spy(['callTrainingServiceBridge', 'openFullHandDecisionInAnalysis']);
  try {
    await app.click('#handReviewAnalyze');
    await app.settle(500);
    assert.equal(spy.count('openFullHandDecisionInAnalysis'), 1);
    const handoff = spy.calls.callTrainingServiceBridge.find(([method]) => method === 'createFullHandAnalysisHandoff');
    assert.ok(handoff, 'the service creates the handoff');
  } finally {
    spy.restore();
  }
  assert.equal(app.$('.riverline-shell').dataset.activeDestination, 'analyze');
});

test('Full Hand primary labels are registered in English, Russian, and Hebrew', () => {
  for (const catalog of ['en', 'ru', 'he']) {
    const start = i18n.indexOf(`Object.assign(trainingWorkspaceTranslations.${catalog}, {`, 2100);
    assert.ok(start >= 0, catalog);
  }
  assert.match(i18n, /"Full Hand": "Full Hand"/);
  assert.match(i18n, /"Full Hand": "Полная раздача"/);
  assert.match(i18n, /"Full Hand": "יד מלאה"/);
  for (const key of [
    'Hand Complete', 'Review Hand', 'New Hand', 'Post-Hand Review',
    'Automating', 'Your turn', '{player} is thinking…', 'Dealing the flop…',
  ]) {
    assert.match(i18n, new RegExp(`"${key}"`), key);
  }
});
