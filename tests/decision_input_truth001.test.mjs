import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

import {
  ACTION_TYPES,
  ANTE_TYPES,
  CHANCE_TYPES,
  GAME_MODES,
  applyAction,
  applyChance,
  createAction,
  getLegalActionSpec,
  initializeHand,
} from '../shared/poker-domain/index.js';
import { deriveDecisionContextFromPokerState } from
  '../app/src/application/decision-context-from-poker-state.mjs';
import {
  createPlaybookScenarioInput,
  deriveDecisionContextFromPlaybookScenario,
} from '../app/src/application/playbook-state-source.mjs';
import { validatePlaybookScenarioReadiness } from
  '../app/src/application/playbook-scenario-readiness.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';

import { bootApp, indexDocument, strategyProviderProbe, text } from './helpers/app-under-test.mjs';

const require = createRequire(import.meta.url);
const qa = require('./qa002_adapters.js');

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
// TEST-HYGIENE-001: logic.js / index.html assertions are behavioural: the
// slider pairs, readiness focus, facing copy, replay, randomizer status, sizing
// copy and Training key hints run in the booted app (spies, a provider probe)
// and markup is parsed, instead of vm-evaluated slices of logic.js.
const markup = indexDocument();
const probe = strategyProviderProbe();
const app = await bootApp({ beforeScripts: probe.beforeScripts });
// decision-facing-summary installs window.RiverlineDecisionFacing when first
// evaluated, so it is imported only after the app has booted.
const {
  DECISION_FACING_KINDS,
  describeDecisionFacing,
  formatDecisionFacing,
} = await import('../app/src/application/decision-facing-summary.mjs');
const page = () => app.window.app;
const REPLAY_CONTROLLER = read('../app/src/application/replay-projection-controller.mjs');
const FACING_MODULE = read('../app/src/application/decision-facing-summary.mjs');

function catalog(path, globalName) {
  const context = { window: {} };
  vm.runInNewContext(read(path), context);
  return context.window[globalName];
}

// ---------------------------------------------------------------------------
// A. Slider-pair numeric drafts
// ---------------------------------------------------------------------------

function sliderHarness(rangeId, numberId) {
  const range = app.byId(rangeId);
  const number = app.byId(numberId);
  const spy = app.spy(['schedulePlaybookUpdate', 'commitPlaybookUpdate']);
  const type = (value) => {
    number.focus();
    number.value = value;
    number.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  };
  const blur = () => {
    number.dispatchEvent(new app.window.Event('change', { bubbles: true }));
    number.blur();
  };
  const calls = { get input() { return spy.count('schedulePlaybookUpdate'); }, get change() { return spy.count('commitPlaybookUpdate'); } };
  const api = { sliderPairValue: (...args) => app.call('sliderPairValue', ...args), readSliderPairDraft: (...args) => app.call('readSliderPairDraft', ...args) };
  const restore = async () => {
    spy.restore();
    number.blur();
    await app.settle(300);
  };
  return { range, number, calls, api, type, blur, restore };
}

/** Restore a slider pair to a committed value (as the user would). */
async function resetSlider(rangeId, numberId, value) {
  const number = app.byId(numberId);
  number.focus();
  number.value = String(value);
  number.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  number.dispatchEvent(new app.window.Event('change', { bubbles: true }));
  number.blur();
  await app.settle(300);
}

await app.navigate('analyze');

const SLIDER_FIELDS = Object.freeze([
  { rangeId: 'players', numberId: 'playersNum', value: 8, min: 2, max: 10, label: 'Table size' },
  { rangeId: 'stack', numberId: 'stackNum', value: 30, min: 10, max: 500, label: 'Starting stack' },
  { rangeId: 'ante', numberId: 'anteNum', value: 0, min: 0, max: 5, label: 'Ante' },
  { rangeId: 'facingSize', numberId: 'facingSizeNum', value: 0, min: 0, max: 100, label: 'Facing size' },
  { rangeId: 'potSize', numberId: 'potSizeNum', value: 1.5, min: 0.5, max: 200, label: 'Pot before action' },
]);

test('A: HTML slider-pair bounds match the field table used by these tests', () => {
  for (const field of SLIDER_FIELDS) {
    for (const id of [field.rangeId, field.numberId]) {
      const input = markup.getElementById(id);
      assert.equal(input?.localName, 'input', `missing #${id}`);
      assert.equal(input.getAttribute('min'), String(field.min));
      assert.equal(input.getAttribute('max'), String(field.max));
    }
  }
});

test('A: every slider-pair field keeps intermediate text exactly and commits only valid parses', async () => {
  for (const field of SLIDER_FIELDS) {
    const harness = sliderHarness(field.rangeId, field.numberId);
    const initial = harness.range.value;
    try {
      let committedRange = initial;
      for (const text of ['2.', '2.5', '', '0.', '2.50']) {
        const inputsBefore = harness.calls.input;
        harness.type(text);
        assert.equal(harness.number.value, text, `${field.numberId} rewrote "${text}"`);
        assert.equal(harness.calls.input, inputsBefore + 1, 'one coalesced update request per keystroke');
        const parsed = Number(text);
        const valid = text.trim() !== '' && Number.isFinite(parsed)
          && parsed >= field.min && parsed <= field.max;
        if (valid) committedRange = String(parsed);
        assert.equal(Number(harness.range.value), Number(committedRange), `${field.rangeId} after "${text}"`);
        const committed = harness.api.sliderPairValue(field.rangeId, -1);
        if (valid) assert.equal(committed, parsed);
        else assert.ok(Number.isNaN(committed), `${field.numberId} "${text}" must not be guessed`);
        // Typing never marks the field invalid while focused.
        assert.equal(harness.number.getAttribute('aria-invalid'), null);
      }
    } finally {
      await harness.restore();
      await resetSlider(field.rangeId, field.numberId, initial);
    }
  }
});

test('A: Analyze facing 2.5 and pot 6.5 stay as typed and are the committed values', async () => {
  for (const [rangeId, numberId, texts, expected] of [
    ['facingSize', 'facingSizeNum', ['2', '2.', '2.5'], 2.5],
    ['potSize', 'potSizeNum', ['6', '6.', '6.5'], 6.5],
  ]) {
    const harness = sliderHarness(rangeId, numberId);
    const initial = harness.range.value;
    try {
      for (const value of texts) harness.type(value);
      assert.equal(harness.number.value, texts.at(-1));
      assert.equal(harness.api.sliderPairValue(rangeId, 0), expected);
    } finally {
      await harness.restore();
      await resetSlider(rangeId, numberId, initial);
    }
  }
});

test('A: blur normalizes a valid value and leaves invalid text visible and marked invalid', async () => {
  const valid = sliderHarness('facingSize', 'facingSizeNum');
  const facingInitial = valid.range.value;
  try {
    valid.type('2.50');
    valid.blur();
    assert.equal(valid.number.value, '2.5');
    assert.equal(valid.number.getAttribute('aria-invalid'), null);
    assert.equal(valid.calls.change, 1);
  } finally {
    await valid.restore();
    await resetSlider('facingSize', 'facingSizeNum', facingInitial);
  }

  const invalid = sliderHarness('stack', 'stackNum');
  const stackInitial = invalid.range.value;
  try {
    invalid.type('5');
    invalid.blur();
    assert.equal(invalid.number.value, '5');
    assert.equal(invalid.range.value, stackInitial);
    assert.equal(invalid.number.getAttribute('aria-invalid'), 'true');
  } finally {
    await invalid.restore();
    await resetSlider('stack', 'stackNum', stackInitial);
  }
});

test('A: incomplete drafts reach the readiness gate and never resolve strategy', async () => {
  const cases = [
    [{ facingSizeNum: '' }, { lastAction: 'raise', facingSize: 3 }, 'facing_amount_invalid', 'facingSizeBb'],
    [{ potSizeNum: '' }, {}, 'pot_invalid', 'potBb'],
    [{ stackNum: '' }, {}, 'stack_invalid', 'stackBb'],
    [{ playersNum: '1' }, {}, 'table_size_invalid', 'tableSize'],
    [{ anteNum: '' }, {}, 'ante_invalid', 'anteBb'],
  ];
  for (const [numberText, values, code, field] of cases) {
    const capture = await qa.captureContext({
      useReadinessResolver: true,
      heroCards: ['As', 'Kd'],
      ...values,
      numberText,
    });
    const [[id, text]] = Object.entries(numberText);
    assert.equal(capture.sliderPairControls[id], text, `${id} text preserved through updateContext`);
    assert.equal(capture.playbookResolution.reason, 'scenario_not_ready');
    const reason = capture.playbookResolution.readiness.reasons.find((entry) => entry.code === code);
    assert.ok(reason, `${code} expected for ${id}`);
    assert.equal(reason.fields[0], field);
    assert.equal(capture.strategyProviderResolveCount, 0);
    assert.equal(capture.strategyResult, null);
  }
});

test('A: typing 2.5 / 6.5 resolves exactly once per update with the typed values (PERF-001)', async () => {
  for (const [facingText, potText] of [['2', '6'], ['2.', '6.'], ['2.5', '6.5']]) {
    const capture = await qa.captureContext({
      useReadinessResolver: true,
      heroCards: ['As', 'Kd'],
      lastAction: 'raise',
      facingSize: 3,
      potSize: 4.5,
      numberText: { facingSizeNum: facingText, potSizeNum: potText },
    });
    assert.equal(capture.playbookResolution.status, 'available');
    assert.equal(capture.strategyProviderResolveCount, 1);
    assert.equal(capture.snapshot.facingSizeBb, Number(facingText));
    assert.equal(capture.snapshot.potBb, Number(potText));
    assert.equal(capture.sliderPairControls.facingSizeNum, facingText);
    assert.equal(capture.sliderPairControls.potSizeNum, potText);
  }
});

test('A: programmatic facing resets never overwrite a focused draft', async () => {
  const number = app.byId('facingSizeNum');
  const initial = app.byId('facingSize').value;
  number.focus();
  number.value = '2.';
  number.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  try {
    // Metrics refresh (which resets facing for an unopened spot) and the
    // reset itself leave the focused draft alone.
    app.call('updateMetrics');
    app.call('setSliderPairDisplay', 'facingSize', 'facingSizeNum', 0);
    assert.equal(number.value, '2.');
  } finally {
    number.blur();
  }
  app.call('setSliderPairDisplay', 'facingSize', 'facingSizeNum', 0);
  assert.equal(number.value, '0', 'an unfocused field is reset');
  await resetSlider('facingSize', 'facingSizeNum', initial);
  // An incomplete table-size draft does not rebuild positions.
  const heroPos = app.byId('heroPos');
  const players = app.byId('playersNum');
  const before = [...heroPos.options].map((option) => option.value);
  const playersInitial = app.byId('players').value;
  players.focus();
  players.value = '';
  players.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  try {
    app.call('updatePositions');
    assert.deepEqual([...heroPos.options].map((option) => option.value), before);
  } finally {
    players.blur();
    await resetSlider('players', 'playersNum', playersInitial);
  }
});

// ---------------------------------------------------------------------------
// B. Readiness wording and focus target
// ---------------------------------------------------------------------------

function scenario(overrides = {}) {
  return createPlaybookScenarioInput({
    tableSize: 6, heroPosition: 'BTN', street: 'preflop', heroCards: ['As', 'Kd'],
    board: [], deadCards: [], stackBb: 100, stackMode: 'hero', potBb: 1.5,
    lastAction: 'unopened', lastActionLabel: 'Unopened', facingSizeBb: 0,
    rakeMode: 'off', forcedContributionPerPlayerBb: 0, totalForcedContributionBb: 0,
    anteBb: 0, straddleBb: 0, ...overrides,
  });
}

const FIELD_LABELS = Object.freeze({
  facingSizeBb: 'Facing size',
  potBb: 'Pot before action',
  stackBb: 'Starting stack',
  tableSize: 'Table size',
  anteBb: 'Ante',
});

test('B: numeric readiness messages name the Analyze field label, never "amount to call"', () => {
  const cases = [
    scenario({ lastAction: 'raise', facingSizeBb: 0 }),
    scenario({ lastAction: 'unopened', facingSizeBb: 3 }),
    scenario({ facingSizeBb: Number.NaN }),
    scenario({ potBb: Number.NaN }),
    scenario({ stackBb: Number.NaN }),
    scenario({ tableSize: Number.NaN }),
    scenario({ anteBb: Number.NaN }),
  ];
  for (const input of cases) {
    const readiness = validatePlaybookScenarioReadiness(input);
    assert.equal(readiness.ready, false);
    const [first] = readiness.reasons;
    const label = FIELD_LABELS[first.fields[0]];
    assert.ok(label, `first field ${first.fields[0]} is a labelled numeric field`);
    assert.ok(first.message.includes(label), `${first.code}: "${first.message}" names ${label}`);
    assert.doesNotMatch(first.message, /amount to call/i);
    assert.ok(markup.querySelectorAll(`[data-i18n="${label}"]`).some((node) => node.textContent === label), label);
  }
});

test('B: new readiness messages have Russian and Hebrew translations', () => {
  const translations = catalog('../app/src/locales/product-translations.js', 'riverlineProductTranslations');
  const messages = [
    'Enter a valid Facing size.',
    'Set Facing size to 0 or choose a bet or raise as the prior action.',
    'Enter the Facing size for this bet or raise.',
    'Enter a valid Pot before action.',
    'Enter a valid Starting stack.',
    'Choose a Table size from 2 to 10 players.',
    'Enter a valid Ante.',
  ];
  const source = read('../app/src/application/playbook-scenario-readiness.mjs');
  for (const message of messages) assert.ok(source.includes(`'${message}'`), message);
  for (const message of messages) {
    assert.equal(typeof translations.ru[message], 'string', `ru ${message}`);
    assert.equal(typeof translations.he[message], 'string', `he ${message}`);
    assert.notEqual(translations.ru[message], message);
    assert.notEqual(translations.he[message], message);
  }
});

test('B: Edit decision inputs focuses the first field the readiness message names', async () => {
  const target = (resolution) => app.call('scenarioReadinessFocusTarget', resolution);
  const resolution = (input) => ({
    mode: 'scenario',
    reason: 'scenario_not_ready',
    readiness: validatePlaybookScenarioReadiness(input),
  });
  assert.equal(target(resolution(scenario({ lastAction: 'raise', facingSizeBb: 0 }))), '#facingSizeNum');
  assert.equal(target(resolution(scenario({ facingSizeBb: 4 }))), '#facingSizeNum');
  assert.equal(target(resolution(scenario({ potBb: Number.NaN }))), '#potSizeNum');
  assert.equal(target(resolution(scenario({ stackBb: Number.NaN }))), '#stackNum');
  assert.equal(target(resolution(scenario({ tableSize: 1 }))), '#playersNum');
  assert.equal(target(resolution(scenario({ anteBb: Number.NaN }))), '#anteNum');
  assert.equal(target(resolution(scenario({ heroCards: ['As'] }))), '[data-card-set-edit="hero"]');
  assert.equal(target({ mode: 'hand', reason: 'canonical_hero_not_actor' }), null);
  for (const id of ['facingSizeNum', 'potSizeNum', 'stackNum', 'playersNum', 'anteNum', 'lastAction', 'heroPos']) {
    assert.ok(markup.getElementById(id), id);
  }
  // In the app: an unready pot sends "Edit decision inputs" straight to the
  // named field (centred without scrolling twice), before any generic
  // context-rail fallback.
  await app.pickCards('#gtoMode [data-card-set-edit="hero"]', ['As', 'Kd']);
  const potInitial = app.byId('potSize').value;
  const pot = app.byId('potSizeNum');
  pot.focus();
  pot.value = '';
  pot.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  pot.blur();
  await app.call('updateContext');
  await app.settle(300);
  const scrolls = [];
  const focuses = [];
  pot.scrollIntoView = (options) => scrolls.push(options);
  const focus = pot.focus;
  pot.focus = function (options) { focuses.push(options); return focus.call(this, options); };
  const spy = app.spy(['focusScenarioReadinessField']);
  try {
    await app.click('#analysisEditInputs');
    assert.equal(spy.count('focusScenarioReadinessField'), 1);
    assert.ok(app.document.activeElement === pot);
    assert.deepEqual(scrolls, [{ block: 'center', behavior: 'instant' }]);
    assert.deepEqual(focuses, [{ preventScroll: true }]);
  } finally {
    spy.restore();
    delete pot.scrollIntoView;
    delete pot.focus;
    pot.blur();
    await resetSlider('potSize', 'potSizeNum', potInitial);
  }
});

// ---------------------------------------------------------------------------
// C. Facing wording from canonical facts
// ---------------------------------------------------------------------------

const HOLE_CARDS = Object.freeze({ P0: ['As', 'Kh'], P1: ['Qd', 'Jc'], P2: ['Ts', '9h'], P3: ['8d', '7c'] });

function dealtTable(stacksBb) {
  let state = initializeHand({
    handId: `decision-input-truth-${stacksBb.join('-')}`,
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: stacksBb.map((stackBb, seat) => ({
      playerId: `P${seat}`, seat, startingStackMilliBb: stackBb * 1000,
    })),
  });
  return applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(state.players.map((player) => [player.playerId, HOLE_CARDS[player.playerId]])),
  });
}

function act(state, type, amountToBb = null) {
  return applyAction(state, createAction(
    state.actingPlayerId,
    type,
    amountToBb === null ? null : amountToBb * 1000,
  ));
}

function heroContext(state) {
  return deriveDecisionContextFromPokerState(state, state.actingPlayerId);
}

const english = catalog('../app/src/locales/analysis-translations.js', 'riverlineAnalysisTranslations').en;
const translate = (key, values = {}) => String(english[key] ?? key)
  .replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));

function line(context) {
  return formatDecisionFacing(describeDecisionFacing(context), { position: context.heroPosition, translate });
}

test('C: unopened, limped, open, 3-bet, BB option and short all-in wording come from canonical facts', () => {
  // 4-handed, button seat 0: P3 acts first, then P0 (BTN), P1 (SB), P2 (BB).
  const unopened = heroContext(act(dealtTable([100, 100, 100, 100]), ACTION_TYPES.FOLD));
  assert.equal(describeDecisionFacing(unopened).kind, DECISION_FACING_KINDS.UNOPENED);
  assert.equal(unopened.facingSizeBb, 0);
  assert.equal(line(unopened), `${unopened.heroPosition} · unopened · 1 bb to call`);

  const limped = heroContext(act(dealtTable([100, 100, 100, 100]), ACTION_TYPES.CALL));
  assert.equal(describeDecisionFacing(limped).kind, DECISION_FACING_KINDS.LIMPED);
  assert.equal(line(limped), `${limped.heroPosition} · limped · 1 bb to call`);

  const open = heroContext(act(dealtTable([100, 100, 100, 100]), ACTION_TYPES.RAISE, 3));
  assert.equal(describeDecisionFacing(open).kind, DECISION_FACING_KINDS.FACING_WAGER);
  assert.equal(line(open), `${open.heroPosition} · facing 3 bb · 3 bb to call`);

  let threeBet = act(dealtTable([100, 100, 100, 100]), ACTION_TYPES.RAISE, 3);
  threeBet = act(threeBet, ACTION_TYPES.RAISE, 9);
  threeBet = act(threeBet, ACTION_TYPES.FOLD);
  threeBet = act(threeBet, ACTION_TYPES.FOLD);
  const facingThreeBet = heroContext(threeBet);
  assert.equal(facingThreeBet.callAmountBb, 6);
  assert.equal(line(facingThreeBet), `${facingThreeBet.heroPosition} · facing 9 bb · 6 bb to call`);

  let option = act(dealtTable([100, 100, 100, 100]), ACTION_TYPES.CALL);
  option = act(option, ACTION_TYPES.CALL);
  option = act(option, ACTION_TYPES.CALL);
  const bbOption = heroContext(option);
  assert.equal(bbOption.heroPosition, 'BB');
  assert.equal(describeDecisionFacing(bbOption).kind, DECISION_FACING_KINDS.OPTION);
  assert.equal(line(bbOption), 'BB · option · check available');

  const shortStack = act(dealtTable([5, 100, 100, 100]), ACTION_TYPES.RAISE, 10);
  const shortCall = heroContext(shortStack);
  const summary = describeDecisionFacing(shortCall);
  assert.equal(summary.kind, DECISION_FACING_KINDS.FACING_WAGER);
  assert.equal(summary.callIsAllIn, true);
  assert.equal(shortCall.callAmountBb, getLegalActionSpec(shortStack).call.commitMilliBb / 1000);
  assert.equal(line(shortCall), `${shortCall.heroPosition} · facing 10 bb · 5 bb to call (all-in)`);

  for (const context of [unopened, limped, bbOption]) assert.doesNotMatch(line(context), /facing 0/);
});

test('C: Scenario-derived Training spots never print "facing 0" beside a call price', () => {
  // Scenario contexts carry no fabricated price (callAmountBb null).
  const sb = deriveDecisionContextFromPlaybookScenario(scenario({ heroPosition: 'SB' }));
  assert.equal(sb.callAmountBb, null);
  assert.equal(formatDecisionFacing(describeDecisionFacing(sb), { translate }), 'Unopened · price unavailable');

  const facingRaise = deriveDecisionContextFromPlaybookScenario(scenario({ lastAction: 'raise', facingSizeBb: 3 }));
  assert.equal(formatDecisionFacing(describeDecisionFacing(facingRaise), { translate }), 'Facing 3 bb · price unavailable');

  const limp = deriveDecisionContextFromPlaybookScenario(scenario({ lastAction: 'limp' }));
  assert.match(formatDecisionFacing(describeDecisionFacing(limp), { translate }), /^Limped · /);

  // Canonical Training contexts: SB unopened prints only the 0.5 bb call price.
  let sbSpot = act(dealtTable([100, 100, 100, 100]), ACTION_TYPES.FOLD);
  sbSpot = act(sbSpot, ACTION_TYPES.FOLD);
  const sbContext = heroContext(sbSpot);
  assert.equal(sbContext.heroPosition, 'SB');
  assert.equal(formatDecisionFacing(describeDecisionFacing(sbContext), { translate }), 'Unopened · 0.5 bb to call');
});

test('C: Review and Training facing copy are consumers of the canonical projection', () => {
  // Review copy is the canonical facing projection of the recorded context;
  // page code never reads the raw facing/call fields itself.
  const context = heroContext(act(dealtTable([100, 100, 100, 100]), ACTION_TYPES.RAISE, 3));
  const { proxy: tracked, reads } = app.trackReads(context);
  // Positive control: the same tracker does see the projection module read the
  // raw facts, so an empty logic.js read set is not a vacuous pass.
  const moduleReads = app.trackReads(context, 'src/application/decision-facing-summary.mjs');
  const expected = app.call('decisionFacingCopy', moduleReads.proxy, context.heroPosition);
  assert.ok(moduleReads.reads.has('facingSizeBb') && moduleReads.reads.has('callAmountBb'), [...moduleReads.reads].map(String).join());
  const spy = app.spy(['decisionFacingCopy']);
  try {
    const copy = app.call('reviewContextCopy', { durable: { decisionContext: tracked, heroPosition: context.heroPosition } });
    assert.equal(spy.count('decisionFacingCopy'), 1);
    assert.equal(spy.calls.decisionFacingCopy[0][0], tracked);
    assert.equal(typeof copy, 'string');
    assert.ok(copy.length > 0 && copy !== app.call('t', 'Unavailable'), copy);
    assert.equal(copy, expected);
    assert.ok(copy.includes(context.heroPosition), copy);
  } finally {
    spy.restore();
  }
  for (const key of ['facingSizeBb', 'callAmountBb']) assert.equal(reads.has(key), false, key);
  assert.equal(app.call('formatTrainingFacingCopy', context), app.call('decisionFacingCopy', context));
  assert.ok(markup.querySelector('script[src="src/application/decision-facing-summary.mjs"]'));
  assert.doesNotMatch(FACING_MODULE, /milliBb|getLegalActionSpec|\+=|\* 1000/);
  const analysis = catalog('../app/src/locales/analysis-translations.js', 'riverlineAnalysisTranslations');
  for (const key of Object.keys(analysis.en).filter((entry) => entry.startsWith('facing.'))) {
    assert.equal(typeof analysis.ru[key], 'string', `ru ${key}`);
    assert.equal(typeof analysis.he[key], 'string', `he ${key}`);
  }
});

// ---------------------------------------------------------------------------
// D/G. Replay frame facts and exits
// ---------------------------------------------------------------------------

function recordedHand() {
  let state = initializeHand({
    handId: 'decision-input-truth-replay',
    game: {
      mode: GAME_MODES.HOME,
      smallBlindMilliBb: 500,
      bigBlindMilliBb: 1000,
      chipUnitMilliBb: 100,
      ante: { type: ANTE_TYPES.NONE, amountMilliBb: 0 },
    },
    buttonSeat: 0,
    players: [0, 1, 2, 3].map((seat) => ({ playerId: `P${seat}`, seat, startingStackMilliBb: 100_000 })),
  });
  let live = state;
  const replay = createReplayProjectionController({ getLiveState: () => live, getHeroPlayerId: () => 'P0' });
  replay.replaceHand({ state, heroPlayerId: 'P0', operation: REPLAY_FRAME_OPERATIONS.INITIALIZE_HAND });
  const states = [state];
  state = applyChance(state, {
    type: CHANCE_TYPES.DEAL_HOLE,
    cardsByPlayer: Object.fromEntries(state.players.map((player) => [player.playerId, HOLE_CARDS[player.playerId]])),
  });
  live = state;
  replay.recordTransition({ state, heroPlayerId: 'P0', operation: REPLAY_FRAME_OPERATIONS.DEAL_HOLE });
  states.push(state);
  for (const [type, amountBb] of [[ACTION_TYPES.RAISE, 3], [ACTION_TYPES.RAISE, 9], [ACTION_TYPES.FOLD, null]]) {
    state = act(state, type, amountBb);
    live = state;
    replay.recordTransition({ state, heroPlayerId: 'P0', operation: REPLAY_FRAME_OPERATIONS.ACTION });
    states.push(state);
  }
  return { replay, states };
}

test('D: replay stage facts follow the cursor and come from the selected frame', () => {
  const { replay, states } = recordedHand();
  const live = replay.getProjection();
  assert.equal(live.atLive, true);
  assert.equal(live.selectedStageFacts, null, 'live renderers keep the live state at the live edge');

  const back = replay.previous();
  const backTwo = replay.previous();
  for (const [projection, state] of [[back, states.at(-2)], [backTwo, states.at(-3)]]) {
    const facts = projection.selectedStageFacts;
    assert.equal(projection.readOnly, true);
    assert.equal(facts.actingPlayerId, state.actingPlayerId);
    assert.equal(facts.potMilliBb, state.potMilliBb);
    assert.equal(facts.currentBetMilliBb, state.currentBetMilliBb);
    assert.equal(facts.callMilliBb, getLegalActionSpec(state).call.commitMilliBb);
    assert.equal(facts.lastAction?.sequence ?? null, state.actionHistory.at(-1)?.sequence ?? null);
    assert.equal(facts.street, state.street);
  }
  assert.notEqual(backTwo.selectedStageFacts.potMilliBb, states.at(-1).potMilliBb);
  assert.ok(Object.isFrozen(backTwo.selectedStageFacts));

  const returned = replay.returnToEndpoint();
  assert.equal(returned.selectedStageFacts, null);
});

test('D: replay seek does no strategy or Equity work and the renderers read frame facts', async () => {
  const imports = REPLAY_CONTROLLER.match(/^import[\s\S]*?;$/gm).join('\n');
  assert.doesNotMatch(imports, /strategy|equity/i);
  assert.match(imports, /getLegalActionSpec/);
  await app.startHand(['As', 'Kd']);
  await app.handAction('call');
  const livePot = text(app.byId('handLivePot'));
  const liveState = app.call('callPlaybookStateBridge', 'getState');
  const spy = app.spy(['updateContext']);
  try {
    const resolves = await probe.count(async () => {
      await app.click('#handReplayPreviousButton');
      await app.settle(300);
    });
    assert.equal(resolves.length, 0, 'a replay seek resolves no strategy');
    assert.equal(spy.count('updateContext'), 0, 'replay_* state changes skip the decision update');
  } finally {
    spy.restore();
  }
  // The stage and state summary read the selected frame, not the live state.
  const facts = app.call('canonicalReplayFrameFacts', app.call('callPlaybookStateBridge', 'createReplayProjectionViewModel'));
  assert.ok(facts);
  assert.notEqual(facts.potMilliBb, liveState.potMilliBb);
  assert.equal(text(app.byId('handLivePot')), app.call('formatCanonicalBb', facts.potMilliBb));
  assert.notEqual(text(app.byId('handLivePot')), livePot);
  assert.equal(text(app.byId('handStatePot')), app.call('formatCanonicalBb', facts.potMilliBb));
  assert.equal(text(app.byId('handLiveCall')), facts.callMilliBb === null ? text(app.byId('handLiveCall')) : app.call('formatCanonicalBb', facts.callMilliBb));
  await app.click('#handReplayLiveButton');
  await app.settle(300);
  assert.equal(text(app.byId('handLivePot')), livePot);
});

test('D: replaying a completed hand offers the same Return control and restores the completion card', async () => {
  await app.startHand(['As', 'Kd']);
  await app.handAction('fold');
  assert.equal(app.byId('handCompletedSection').hidden, false);
  await app.click('#handReplayPreviousButton');
  await app.settle(300);
  const back = app.byId('handReplayLiveButton');
  assert.equal(back.hidden, false, 'a Return control is offered for a completed hand');
  assert.equal(text(back), app.call('t', 'replay.control.returnToCompleted'));
  assert.equal(app.byId('handCompletedSection').hidden, true, 'the completion card hides while replaying');
  await app.click(back);
  await app.settle(300);
  assert.equal(app.byId('handCompletedSection').hidden, false, 'returning restores the completion card');
  const analysis = catalog('../app/src/locales/analysis-translations.js', 'riverlineAnalysisTranslations');
  for (const language of ['en', 'ru', 'he']) {
    assert.equal(typeof analysis[language]['replay.control.returnToCompleted'], 'string');
  }
});

test('G: the saved Replay chip resolves to translated text in every language', () => {
  const home = catalog('../app/src/locales/home-translations.js', 'riverlineHomeTranslations');
  assert.equal(home.en['replay.status.saved'], 'SAVED');
  assert.equal(home.en['replay.control.returnToSavedHand'], 'Return to end of saved hand');
  for (const language of ['ru', 'he']) {
    assert.notEqual(home[language]['replay.status.saved'], 'replay.status.saved');
  }
});

// ---------------------------------------------------------------------------
// E. Stale randomizer status
// ---------------------------------------------------------------------------

function statusHarness() {
  const status = app.byId('handRandomizeStatus');
  const live = { state: null };
  return {
    app: page(),
    status,
    live,
    setHandRandomizationStatus: (...args) => app.call('setHandRandomizationStatus', ...args),
    reconcileHandRandomizationStatus: (...args) => app.call('reconcileHandRandomizationStatus', ...args),
  };
}

test('E: randomizer "ready" status clears after commit, cancel, street advance or hand completion', async () => {
  const bridge = app.window.callPlaybookStateBridge;
  const draft = { ...page().playbookHandDraft };
  const harnessLive = { state: null };
  app.window.callPlaybookStateBridge = (method, ...args) => (method === 'getState' ? harnessLive.state : bridge(method, ...args));
  try {
  const flopPending = { phase: 'chance', street: 'preflop', pendingChance: { type: 'deal_flop' }, actionHistory: [1, 2] };
  const flopDealt = { phase: 'betting', street: 'flop', pendingChance: null, actionHistory: [1, 2] };
  const harness = statusHarness();
  harness.live = harnessLive;
  harness.live.state = flopPending;
  harness.app.playbookHandDraft.board = ['2c', '7d', 'Th'];
  harness.setHandRandomizationStatus('Random {street} ready.', { street: 'Flop' }, 'flop');
  harness.reconcileHandRandomizationStatus(flopPending);
  assert.equal(harness.status.textContent, 'Random Flop ready.', 'kept while the same draft is pending');

  harness.reconcileHandRandomizationStatus(flopDealt);
  assert.equal(harness.status.textContent, '', 'committed: the stage advanced');

  harness.setHandRandomizationStatus('Random {street} ready.', { street: 'Flop' }, 'flop');
  harness.app.playbookHandDraft.board = [];
  harness.reconcileHandRandomizationStatus(flopPending);
  assert.equal(harness.status.textContent, '', 'cancelled: the draft was cleared');

  const reveal = { phase: 'showdown', street: 'river', pendingChance: null, showdown: { status: 'awaiting_private_reveal' }, actionHistory: [1] };
  const complete = { phase: 'terminal', street: 'river', pendingChance: null, showdown: { status: 'resolved' }, actionHistory: [1] };
  harness.live.state = reveal;
  harness.app.playbookHandDraft.bySeat = { 1: ['As', 'Kd'] };
  harness.setHandRandomizationStatus('Random private cards ready.', {}, 'private_reveal');
  harness.reconcileHandRandomizationStatus(reveal);
  assert.equal(harness.status.textContent, 'Random private cards ready.');
  harness.reconcileHandRandomizationStatus(complete);
  assert.equal(harness.status.textContent, '', 'hand completed');

  } finally {
    app.window.callPlaybookStateBridge = bridge;
    Object.assign(page().playbookHandDraft, draft);
  }
  // Every Hand workspace render reconciles the status with the live state.
  const spy = app.spy(['reconcileHandRandomizationStatus']);
  try {
    app.call('renderCanonicalHandWorkspace');
    assert.ok(spy.count('reconcileHandRandomizationStatus') >= 1);
    assert.equal(spy.calls.reconcileHandRandomizationStatus[0][0], app.call('callPlaybookStateBridge', 'getState'));
  } finally {
    spy.restore();
  }
});

// ---------------------------------------------------------------------------
// F. Plain sizing language
// ---------------------------------------------------------------------------

test('F: no user-visible amount-to jargon remains in Hand or Training sizing copy', async () => {
  assert.doesNotMatch(markup.body.textContent, /amount-to/i);
  assert.equal(markup.querySelectorAll('[data-i18n]').filter((node) => /amount-to/i.test(node.dataset.i18n)).length, 0);
  const apply = markup.getElementById('handCommitSizedAction');
  assert.equal(apply.dataset.i18n, 'Apply');
  assert.equal(apply.textContent, 'Apply');
  assert.ok(markup.querySelectorAll('[data-i18n="Bet size"]').some((node) => node.textContent === 'Bet size'));
  // Sizing a raise and a bet in the app translates only plain wording.
  const t = app.window.t;
  const keys = [];
  app.window.t = (key, ...rest) => { keys.push(String(key)); return t(key, ...rest); };
  try {
    await app.startHand(['As', 'Kd']);
    await app.click('#handLegalActions [data-canonical-action="raise"]');
    assert.equal(text(app.byId('handActionSizingLabel')), 'Raise to');
    app.call('renderCanonicalHandWorkspace');
    await app.handAction('call');
    await app.handAction('check');
    await app.dealBoard(['2c', '3d', '4s']);
    await app.click('#handLegalActions [data-canonical-action="bet"]');
    assert.equal(text(app.byId('handActionSizingLabel')), 'Bet to');
    app.call('renderCanonicalHandWorkspace');
  } finally {
    app.window.t = t;
  }
  assert.ok(keys.includes('Raise to') && keys.includes('Bet to'));
  assert.deepEqual(keys.filter((key) => /amount-to/i.test(key)), []);
  const product = catalog('../app/src/locales/product-translations.js', 'riverlineProductTranslations');
  for (const key of ['Total for this street', 'Custom size', '{min}–{max} bb total', 'choose bet size']) {
    assert.equal(typeof product.ru[key], 'string', `ru ${key}`);
    assert.equal(typeof product.he[key], 'string', `he ${key}`);
  }
});

// ---------------------------------------------------------------------------
// H. Training key hints
// ---------------------------------------------------------------------------

test('H: Training keyboard hint lists exactly the available action keys', async () => {
  const help = app.byId('trainingShortcutHelp');
  const range = app.byId('trainingShortcutRange');
  const render = (count) => app.call('renderTrainingShortcutHint', count);
  render(4);
  assert.equal(range.textContent, '1-4');
  assert.equal(help.hidden, false);
  render(2);
  assert.equal(range.textContent, '1-2');
  render(1);
  assert.equal(range.textContent, '1');
  render(0);
  assert.equal(help.hidden, true);
  // The live hint follows the rendered answer buttons.
  const spy = app.spy(['renderTrainingShortcutHint']);
  try {
    await app.training.start('focused');
    assert.ok(spy.count('renderTrainingShortcutHint') >= 1);
    assert.equal(spy.calls.renderTrainingShortcutHint.at(-1)[0], app.byId('trainingGuessButtons').childElementCount);
  } finally {
    spy.restore();
  }
  assert.ok(markup.getElementById('trainingShortcutRange'));
});
