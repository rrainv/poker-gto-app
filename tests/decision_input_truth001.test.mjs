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
  DECISION_FACING_KINDS,
  describeDecisionFacing,
  formatDecisionFacing,
} from '../app/src/application/decision-facing-summary.mjs';
import {
  REPLAY_FRAME_OPERATIONS,
  createReplayProjectionController,
} from '../app/src/application/replay-projection-controller.mjs';

const require = createRequire(import.meta.url);
const qa = require('./qa002_adapters.js');

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const LOGIC = read('../app/src/core/logic.js');
const HTML = read('../app/index.html');
const REPLAY_CONTROLLER = read('../app/src/application/replay-projection-controller.mjs');
const FACING_MODULE = read('../app/src/application/decision-facing-summary.mjs');

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source slice ${start} -> ${end}`);
  return source.slice(from, to);
}

function catalog(path, globalName) {
  const context = { window: {} };
  vm.runInNewContext(read(path), context);
  return context.window[globalName];
}

// ---------------------------------------------------------------------------
// A. Slider-pair numeric drafts
// ---------------------------------------------------------------------------

function fakeInput({ value, min, max }) {
  const listeners = new Map();
  return {
    value: String(value),
    min: String(min),
    max: String(max),
    attributes: {},
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
    dispatch(type) { (listeners.get(type) || []).forEach((listener) => listener()); },
    setAttribute(name, next) { this.attributes[name] = String(next); },
    removeAttribute(name) { delete this.attributes[name]; },
  };
}

function sliderHarness(rangeId, numberId, { value, min, max }) {
  const range = fakeInput({ value, min, max });
  const number = fakeInput({ value, min, max });
  const elements = new Map([[`#${rangeId}`, range], [`#${numberId}`, number]]);
  const context = {
    document: { activeElement: null },
    elements,
    calls: { input: 0, change: 0 },
  };
  vm.runInNewContext(`
    const $ = (selector) => elements.get(selector) || null;
    function selectedValue(selector) { return $(selector)?.value; }
    function numericValue(id, fallback = 0) {
      const value = Number(selectedValue(id));
      return Number.isFinite(value) ? value : fallback;
    }
    ${sourceBetween(LOGIC, 'function syncSliderPair(rangeId, numberId) {', 'let homeViewModel = null;')}
    bindSliderPair(${JSON.stringify(rangeId)}, ${JSON.stringify(numberId)}, {
      onInput: () => { calls.input += 1; },
      onChange: () => { calls.change += 1; },
    });
    globalThis.api = { sliderPairValue, readSliderPairDraft };
  `, context);
  const type = (text) => {
    context.document.activeElement = number;
    number.value = text;
    number.dispatch('input');
  };
  const blur = () => {
    context.document.activeElement = null;
    number.dispatch('change');
    number.dispatch('blur');
  };
  return { range, number, calls: context.calls, api: context.api, type, blur };
}

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
      const tag = HTML.match(new RegExp(`<input[^>]+id="${id}"[^>]*>`))?.[0];
      assert.ok(tag, `missing #${id}`);
      assert.match(tag, new RegExp(`min="${field.min}"`));
      assert.match(tag, new RegExp(`max="${field.max}"`));
    }
  }
});

test('A: every slider-pair field keeps intermediate text exactly and commits only valid parses', () => {
  for (const field of SLIDER_FIELDS) {
    const harness = sliderHarness(field.rangeId, field.numberId, field);
    let committedRange = String(field.value);
    for (const text of ['2.', '2.5', '', '0.', '2.50']) {
      const inputsBefore = harness.calls.input;
      harness.type(text);
      assert.equal(harness.number.value, text, `${field.numberId} rewrote "${text}"`);
      assert.equal(harness.calls.input, inputsBefore + 1, 'one coalesced update request per keystroke');
      const parsed = Number(text);
      const valid = text.trim() !== '' && Number.isFinite(parsed)
        && parsed >= field.min && parsed <= field.max;
      if (valid) committedRange = String(parsed);
      assert.equal(harness.range.value, committedRange, `${field.rangeId} after "${text}"`);
      const committed = harness.api.sliderPairValue(field.rangeId, -1);
      if (valid) assert.equal(committed, parsed);
      else assert.ok(Number.isNaN(committed), `${field.numberId} "${text}" must not be guessed`);
      // Typing never marks the field invalid while focused.
      assert.equal(harness.number.attributes['aria-invalid'], undefined);
    }
  }
});

test('A: Analyze facing 2.5 and pot 6.5 stay as typed and are the committed values', () => {
  const facing = sliderHarness('facingSize', 'facingSizeNum', SLIDER_FIELDS[3]);
  for (const text of ['2', '2.', '2.5']) facing.type(text);
  assert.equal(facing.number.value, '2.5');
  assert.equal(facing.api.sliderPairValue('facingSize', 0), 2.5);

  const pot = sliderHarness('potSize', 'potSizeNum', SLIDER_FIELDS[4]);
  for (const text of ['6', '6.', '6.5']) pot.type(text);
  assert.equal(pot.number.value, '6.5');
  assert.equal(pot.api.sliderPairValue('potSize', 0), 6.5);
});

test('A: blur normalizes a valid value and leaves invalid text visible and marked invalid', () => {
  const valid = sliderHarness('facingSize', 'facingSizeNum', SLIDER_FIELDS[3]);
  valid.type('2.50');
  valid.blur();
  assert.equal(valid.number.value, '2.5');
  assert.equal(valid.number.attributes['aria-invalid'], undefined);
  assert.equal(valid.calls.change, 1);

  const invalid = sliderHarness('stack', 'stackNum', SLIDER_FIELDS[1]);
  invalid.type('5');
  invalid.blur();
  assert.equal(invalid.number.value, '5');
  assert.equal(invalid.range.value, '30');
  assert.equal(invalid.number.attributes['aria-invalid'], 'true');
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

test('A: programmatic facing resets never overwrite a focused draft', () => {
  const display = sourceBetween(LOGIC, 'function setSliderPairDisplay(', 'const SLIDER_PAIR_NUMBER_IDS');
  assert.match(display, /document\.activeElement !== number/);
  const metrics = sourceBetween(LOGIC, 'function updateMetrics()', 'const ACTION_PATH_COMPACT_MEDIA');
  assert.match(metrics, /setSliderPairDisplay\('facingSize', 'facingSizeNum', 0\)/);
  const sync = sourceBetween(LOGIC, 'function syncSliderPair(rangeId, numberId) {', 'function normalizeSliderPairDisplay(');
  assert.doesNotMatch(sync, /number\.value\s*=/);
  assert.match(LOGIC, /function updatePositions\(\) \{[\s\S]{0,240}readSliderPairDraft\(\$\('#playersNum'\)\)\.state === 'incomplete'\) return;/);
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
    assert.match(HTML, new RegExp(`data-i18n="${label}">${label}<`));
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

function focusTargetHarness() {
  const context = {};
  vm.runInNewContext(`
    const PLAYBOOK_MODES = { SCENARIO: 'scenario', HAND: 'hand' };
    ${sourceBetween(LOGIC, 'const SCENARIO_READINESS_FIELD_CONTROLS', 'function focusScenarioReadinessField(')}
    globalThis.target = scenarioReadinessFocusTarget;
  `, context);
  return context.target;
}

test('B: Edit decision inputs focuses the first field the readiness message names', () => {
  const target = focusTargetHarness();
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
    assert.match(HTML, new RegExp(`id="${id}"`));
  }
  const handler = sourceBetween(LOGIC, 'function setRecommendationState(state) {', 'const SCENARIO_READINESS_FIELD_CONTROLS');
  assert.ok(handler.indexOf('focusScenarioReadinessField(app.playbookResolution)')
    < handler.indexOf("document.querySelector('.playbook-context-rail')"));
  const focus = sourceBetween(LOGIC, 'function focusScenarioReadinessField(', 'function analysisUnavailableReasonForResolution(');
  assert.match(focus, /scrollIntoView\(\{ block: 'center', behavior: 'instant' \}\)/);
  assert.match(focus, /focus\(\{ preventScroll: true \}\)/);
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
  const review = sourceBetween(LOGIC, 'function reviewContextCopy(decision) {', 'function renderHandReviewCards(');
  assert.match(review, /decisionFacingCopy\(decision\.durable\.decisionContext, actor\)/);
  assert.doesNotMatch(review, /facingSizeBb|callAmountBb/);
  assert.match(LOGIC, /function formatTrainingFacingCopy\(context\) \{\n  return decisionFacingCopy\(context\);/);
  assert.match(HTML, /src="src\/application\/decision-facing-summary\.mjs"/);
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

test('D: replay seek does no strategy or Equity work and the renderers read frame facts', () => {
  const imports = REPLAY_CONTROLLER.match(/^import[\s\S]*?;$/gm).join('\n');
  assert.doesNotMatch(imports, /strategy|equity/i);
  assert.match(imports, /getLegalActionSpec/);
  const stage = sourceBetween(LOGIC, 'function renderCanonicalHandStage(', 'function renderCanonicalPrivateDeal(');
  assert.match(stage, /const frameFacts = canonicalReplayFrameFacts\(replayProjection\)/);
  assert.match(stage, /frameFacts \? frameFacts\.lastAction : state\?\.actionHistory\?\.at\(-1\)/);
  assert.match(stage, /formatCanonicalBb\(frameFacts\.potMilliBb\)/);
  assert.match(stage, /formatCanonicalBb\(frameFacts\.callMilliBb\)/);
  const workspace = sourceBetween(LOGIC, 'function renderCanonicalHandWorkspace() {', 'function activeHandReviewInput(');
  assert.match(workspace, /canonicalStatusStateFromFrameFacts\(frameFacts\)/);
  assert.match(workspace, /const shownPot = frameFacts \? frameFacts\.potMilliBb : state\?\.potMilliBb/);
  const listener = sourceBetween(LOGIC, 'function bindPlaybookModeControl() {', 'let savedStudyCurrentObject = null;');
  assert.match(listener, /startsWith\('replay_'\)[\s\S]*?return;\n\s*updateContext/);
});

test('D: replaying a completed hand offers the same Return control and restores the completion card', () => {
  const controls = sourceBetween(LOGIC, 'function renderCanonicalReplayControls(', 'function renderCanonicalReplayTimeline()');
  assert.match(controls, /const canExitReplayToCompleted = projection\.mode === 'replay'[\s\S]*?!liveHandInProgress/);
  assert.match(controls, /'replay\.control\.returnToCompleted'/);
  assert.match(controls, /live\.hidden = !canExitReplayToLive && !canExitReplayToCompleted/);
  const stage = sourceBetween(LOGIC, 'function renderCanonicalHandStage(', 'function renderCanonicalPrivateDeal(');
  assert.match(stage, /completed\.hidden = !terminal \|\| replayProjection\?\.readOnly === true/);
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
  const status = { textContent: '' };
  const context = {
    status,
    live: { state: null },
  };
  vm.runInNewContext(`
    const app = { playbookHandDraft: { bySeat: {}, board: [], randomizationStatusStage: null, randomizationStatusTarget: null } };
    const $ = (selector) => (selector === '#handRandomizeStatus' ? status : null);
    const t = (key, values = {}) => String(key).replace(/\\{(\\w+)\\}/g, (match, name) => (name in values ? String(values[name]) : match));
    const callPlaybookStateBridge = (method) => (method === 'getState' ? live.state : null);
    const normalizedDecisionCards = (cards) => (Array.isArray(cards) ? cards.filter(Boolean) : []);
    ${sourceBetween(LOGIC, 'function canonicalHandDraftStageKey(state) {', 'function renderHandRandomizationRecipe(')}
    globalThis.api = { app, setHandRandomizationStatus, reconcileHandRandomizationStatus };
  `, context);
  return { ...context.api, status, live: context.live };
}

test('E: randomizer "ready" status clears after commit, cancel, street advance or hand completion', () => {
  const flopPending = { phase: 'chance', street: 'preflop', pendingChance: { type: 'deal_flop' }, actionHistory: [1, 2] };
  const flopDealt = { phase: 'betting', street: 'flop', pendingChance: null, actionHistory: [1, 2] };
  const harness = statusHarness();
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

  const workspace = sourceBetween(LOGIC, 'function renderCanonicalHandWorkspace() {', 'function activeHandReviewInput(');
  assert.match(workspace, /reconcileHandRandomizationStatus\(state\)/);
});

// ---------------------------------------------------------------------------
// F. Plain sizing language
// ---------------------------------------------------------------------------

test('F: no user-visible amount-to jargon remains in Hand or Training sizing copy', () => {
  assert.doesNotMatch(HTML, />[^<]*amount-to[^<]*</i);
  assert.doesNotMatch(HTML, /data-i18n="[^"]*amount-to/i);
  assert.doesNotMatch(LOGIC, /t\('[^']*amount-to/i);
  assert.match(HTML, /id="handCommitSizedAction"[^>]+data-i18n="Apply">Apply</);
  assert.match(HTML, /data-i18n="Bet size">Bet size</);
  assert.match(LOGIC, /t\(type === 'bet' \? 'Bet to' : 'Raise to'\)/);
  const product = catalog('../app/src/locales/product-translations.js', 'riverlineProductTranslations');
  for (const key of ['Total for this street', 'Custom size', '{min}–{max} bb total', 'choose bet size']) {
    assert.equal(typeof product.ru[key], 'string', `ru ${key}`);
    assert.equal(typeof product.he[key], 'string', `he ${key}`);
  }
});

// ---------------------------------------------------------------------------
// H. Training key hints
// ---------------------------------------------------------------------------

function element(tag) {
  return {
    tag,
    hidden: false,
    textContent: '',
    children: [],
    replaceChildren(...nodes) { this.children = nodes; },
  };
}

test('H: Training keyboard hint lists exactly the available action keys', () => {
  const help = element('p');
  const range = element('span');
  const context = { help, range };
  vm.runInNewContext(`
    const $ = (selector) => ({ '#trainingShortcutHelp': help, '#trainingShortcutRange': range })[selector] || null;
    const document = {
      createElement: (tag) => ({ tag, textContent: '' }),
      createTextNode: (text) => ({ tag: '#text', textContent: text }),
    };
    ${sourceBetween(LOGIC, 'function renderTrainingShortcutHint(actionCount) {', 'function renderTrainingSource(')}
    globalThis.render = renderTrainingShortcutHint;
  `, context);
  const text = () => range.children.map((node) => node.textContent).join('');
  context.render(4);
  assert.equal(text(), '1-4');
  assert.equal(help.hidden, false);
  context.render(2);
  assert.equal(text(), '1-2');
  context.render(1);
  assert.equal(text(), '1');
  context.render(0);
  assert.equal(help.hidden, true);
  const buttons = sourceBetween(LOGIC, 'function updateTrainingButtons(exercise) {', 'function renderTrainingShortcutHint(');
  assert.match(buttons, /renderTrainingShortcutHint\(container\.childElementCount\)/);
  assert.match(HTML, /id="trainingShortcutRange"/);
});
