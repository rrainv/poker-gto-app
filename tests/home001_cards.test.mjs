import test from 'node:test';
import assert from 'node:assert/strict';

import { bootApp } from './helpers/app-under-test.mjs';
import {
  HOME_CARD_LIMIT,
  HOME_DRIFT_MIN_HANDS,
  HOME_NOTICED_LIMIT,
  HOME_PLAN_VS_PLAYED_MIN_HANDS,
  deriveSessionPlan,
  homeGreetingPart,
  homeSampleTier,
  homeVisitState,
  planHomeCards,
  selectNoticedItems,
} from '../app/src/application/home-cards.mjs';
import {
  createGuestHomeViewModel,
  createHomeViewModelController,
} from '../app/src/application/home-view-model.mjs';

// HOME-001: the Home card grid. Pure decisions (home-cards.mjs), the view
// model's night-after and noticed sections, and the rendered Home through the
// running app: one solid primary, card limits, honest empty states, the
// sample gates, and owner isolation (A -> B -> sign-out).

const item = (id, extra = {}) => ({
  id, kind: 'hand', title: `Item ${id}`, tags: [], tableSize: 6, heroPosition: 'BTN', street: 'flop',
  updatedAt: '2026-10-30T10:00:00.000Z', ...extra,
});
const ready = (items) => ({ status: 'ready', items });
const sections = (over = {}) => ({
  continue: ready([]),
  recent: ready([]),
  review: { status: 'ready', reviewLater: ready([]), mistakes: ready([]) },
  personalStrategy: { status: 'unavailable' },
  quickStart: { status: 'ready', destinations: [] },
  nightAfter: { status: 'ready', night: null },
  noticed: ready([]),
  ...over,
});
const model = (over = {}, mode = 'account') => ({ sessionMode: mode, identity: { profile: { displayName: 'Dana' } }, sync: null, sections: sections(over) });
const night = { sessionId: 's1', title: 'Friday', state: 'completed', endedAt: '2026-10-31T22:00:00.000Z', updatedAt: null, playerCount: 6, transferCount: 4, settledText: '₪420.00' };
const played = (kind, sampleSize, extra = {}) => ({
  id: `${kind}-${sampleSize}`, kind, source: 'played_hands', spotLabel: 'BB vs small open', sampleSize,
  playedCount: 14, playedPercent: 30, planPercent: 45, baseline: 'mixed', ...extra,
});

/* ----------------------------------------------------------- pure logic */

test('sample gates: plan vs played from 8 hands, drift from 20 against a mixed baseline, played hands only', () => {
  assert.equal(HOME_PLAN_VS_PLAYED_MIN_HANDS, 8);
  assert.equal(HOME_DRIFT_MIN_HANDS, 20);
  const pick = (items) => selectNoticedItems(ready(items)).map((entry) => entry.id);
  assert.deepEqual(pick([played('plan_vs_played', 7)]), [], '7 hands is below the gate');
  assert.deepEqual(pick([played('plan_vs_played', 8)]), ['plan_vs_played-8']);
  assert.deepEqual(pick([played('drift', 19)]), []);
  assert.deepEqual(pick([played('drift', 20)]), ['drift-20']);
  assert.deepEqual(pick([played('drift', 40, { baseline: 'single' })]), [], 'drift needs a mixed baseline');
  assert.deepEqual(pick([played('plan_vs_played', 30, { source: 'drills' })]), [], 'drills are not played hands');
  assert.deepEqual(pick([played('plan_vs_played', 30, { sampleSize: '30' })]), [], 'an unknown size never passes');
  assert.equal(selectNoticedItems({ status: 'error', items: [played('plan_vs_played', 30)] }).length, 0);
  assert.equal(selectNoticedItems(ready([1, 2, 3].map((n) => played('plan_vs_played', 10 + n, { id: `p${n}` })))).length, HOME_NOTICED_LIMIT);
  assert.deepEqual([7, 8, 14, 15, 29, 30].map(homeSampleTier), [null, 'small', 'small', 'medium', 'medium', 'large']);
});

test('first visit versus returning, and the cards each shows (never more than six, no blank slot)', () => {
  assert.equal(homeVisitState(model()), 'first_visit');
  assert.equal(homeVisitState(model({ recent: ready([item('a')]) })), 'returning');
  assert.equal(homeVisitState(model({ recent: { status: 'error' } })), 'returning', 'a failed load is not a first visit');
  assert.equal(homeVisitState(model({ nightAfter: { status: 'ready', night } })), 'returning');
  const first = planHomeCards(model());
  assert.deepEqual([...first.cards], ['welcome', 'session', 'noticed', 'start']);

  const quiet = planHomeCards(model({ recent: ready([item('a')]) }));
  assert.deepEqual([...quiet.cards], ['session', 'noticed', 'recent', 'start'], 'no Continue, Night or Review card without data; Start something fills the room');

  const full = planHomeCards(model({
    continue: ready([{ kind: 'live_hand' }]),
    recent: ready([1, 2, 3, 4, 5, 6].map((n) => item(`r${n}`))),
    review: { status: 'ready', reviewLater: ready([item('v1')]), mistakes: ready([item('m1')]) },
    nightAfter: { status: 'ready', night },
  }));
  assert.deepEqual([...full.cards].sort(), ['continue', 'night', 'noticed', 'recent', 'review', 'session'], 'five or more other cards: no Start something');
  const five = planHomeCards(model({ recent: ready([item('a')]), review: { status: 'ready', reviewLater: ready([item('v')]), mistakes: ready([]) }, nightAfter: { status: 'ready', night } }));
  assert.deepEqual([...five.cards], ['session', 'night', 'noticed', 'review', 'recent'], 'five others: Start something is left out');
  assert.ok(full.cards.length <= HOME_CARD_LIMIT);
  assert.ok(full.start.length >= 1 && full.end.length >= 1, 'two columns, neither empty');
  assert.equal(full.start[0], 'continue', 'the lead card opens the start column');
  assert.deepEqual([...full.start, ...full.end].sort(), [...full.cards].sort(), 'every card is placed once');
});

test("today's session is built only from things that exist, and says when nothing is due", () => {
  const nothing = deriveSessionPlan(model());
  assert.equal(nothing.state, 'nothing_due');
  assert.equal(nothing.dueCount, 0);
  assert.deepEqual(nothing.steps.map((step) => step.kind), ['practice']);
  const some = deriveSessionPlan(model({
    review: { status: 'ready', reviewLater: ready([item('v1'), item('v2'), item('v3')]), mistakes: ready([item('m1')]) },
  }));
  assert.equal(some.state, 'steps');
  assert.ok(some.steps.length <= 3, 'at most three rows');
  assert.deepEqual(some.steps.map((step) => step.kind), ['review_later', 'review_later', 'practice']);
  assert.equal(deriveSessionPlan(model({ review: { status: 'ready', reviewLater: { status: 'error' }, mistakes: ready([]) } })).state, 'unavailable');
  assert.deepEqual(['2026-11-02T06:00:00', '2026-11-02T13:00:00', '2026-11-02T21:00:00', '2026-11-02T03:00:00']
    .map((iso) => homeGreetingPart(new Date(iso))), ['morning', 'afternoon', 'evening', 'evening']);
});

/* ------------------------------------------------------ the view model */

test('the view model carries the last game night and the noticed items, and isolates their failures', async () => {
  const base = {
    savedStudyQueries: { listRecent: async () => [], listForReview: async () => [], listMistakes: async () => [] },
    personalStrategyQueries: { loadSummary: async () => ({ profileCount: 0, selectedProfile: null, selectedMode: null, context: null, answeredCount: 0, totalCount: 0, session: null, resumable: false }) },
  };
  const without = await createHomeViewModelController(base).load();
  assert.equal(without.sections.nightAfter.status, 'unavailable');
  assert.deepEqual(without.sections.noticed, { status: 'ready', items: [] }, 'no source wired: an honest empty section');

  const withQueries = await createHomeViewModelController({
    ...base,
    gameNightQueries: { getLatest: async () => ({ ...night, extra: 'dropped' }) },
    noticedQueries: { getItems: async () => [played('plan_vs_played', 12)] },
  }).load();
  assert.equal(withQueries.sections.nightAfter.night.title, 'Friday');
  assert.equal('extra' in withQueries.sections.nightAfter.night, false);
  assert.equal(withQueries.sections.noticed.items.length, 1);

  const failing = await createHomeViewModelController({
    ...base,
    gameNightQueries: { getLatest: async () => { throw new Error('boom'); } },
    noticedQueries: { getItems: async () => { throw new Error('boom'); } },
  }).load();
  assert.equal(failing.sections.nightAfter.status, 'error');
  assert.equal(failing.sections.noticed.status, 'error');
  assert.equal(failing.sections.recent.status, 'ready', 'other sections are unaffected');

  assert.equal(createGuestHomeViewModel({ nightAfter: { ...night } }).sections.nightAfter.night.title, 'Friday');
  assert.equal(createGuestHomeViewModel({ nightAfter: null }).sections.nightAfter.night, null);
  assert.throws(() => createHomeViewModelController({ ...base, gameNightQueries: {} }), /getLatest/);
});

/* ------------------------------------------------- Home in the running app */

const app = await bootApp();
const $ = (selector) => app.$(selector);
const win = app.window;
const text = (selector) => ($(selector)?.textContent || '').replace(/\s+/g, ' ').trim();

const originals = new Map();
function override(name, changes) {
  if (!originals.has(name)) originals.set(name, win[name]);
  const base = originals.get(name);
  const copy = {};
  for (const key of Reflect.ownKeys(base ?? {})) copy[key] = base[key];
  Object.assign(copy, changes);
  Object.defineProperty(win, name, { configurable: true, enumerable: false, writable: false, value: Object.freeze(copy) });
}
let nextModel = null;
override('RiverlineHome', { load: async () => nextModel, openSavedItem: async () => null });
test.after(() => { for (const [name, value] of originals) Object.defineProperty(win, name, { configurable: true, enumerable: false, writable: false, value }); });

const controller = () => app.evaluate('homeWorkspaceController');
async function show(next) {
  if ($('.riverline-shell').dataset.activeDestination !== 'home') await app.navigate('home');
  nextModel = next;
  await app.call('refreshHomeWorkspace');
  await app.flush();
}
const primaries = () => app.$$('#homeWorkspaceContent .ui-button--primary');
const shownCards = () => app.$$('#homeCards .home-card').filter((card) => !card.hidden);

test('exactly one solid primary in every state: Resume leads while something is in progress, else the session', async () => {
  await show(model());
  assert.equal(primaries().length, 1, 'first visit: the welcome action');
  assert.equal(text('#homeWelcomeActions .ui-button--primary'), 'Start the first drill');

  await show(model({ recent: ready([item('a')]) }));
  assert.equal(primaries().length, 1);
  assert.equal(text('#homeSessionContent .ui-button--primary'), 'Practice a quick drill', 'nothing due: the drill is the session');

  await show(model({ review: { status: 'ready', reviewLater: ready([item('v1')]), mistakes: ready([]) } }));
  assert.equal(primaries().length, 1);
  assert.equal(text('#homeSessionContent .ui-button--primary'), "Start today's session");

  await show(model({ continue: ready([{ kind: 'live_hand' }]), review: { status: 'ready', reviewLater: ready([item('v1')]), mistakes: ready([]) } }));
  assert.equal(primaries().length, 1);
  assert.equal(text('#homeContinueContent .ui-button--primary'), 'Return to live hand');
  assert.match($('#homeSessionContent .ui-button').className, /ui-button--secondary/, "today's session is secondary while Resume leads");

  await show(model({ nightAfter: { status: 'ready', night }, recent: ready([item('a')]) }));
  assert.equal(primaries().length, 1);
});

test('card limits: at most 6 cards, 3 review rows, 5 recent rows, no blank slot, nothing stale in a left-out card', async () => {
  await show(model({
    continue: ready([{ kind: 'live_hand' }]),
    recent: ready([1, 2, 3, 4, 5, 6].map((n) => item(`r${n}`))),
    review: { status: 'ready', reviewLater: ready([1, 2, 3].map((n) => item(`v${n}`))), mistakes: ready([item('m1')]) },
    nightAfter: { status: 'ready', night },
  }));
  assert.equal(shownCards().length, 6);
  assert.equal(app.$$('#homeReviewContent .home-row').length, 3);
  assert.equal(app.$$('#homeRecentContent .home-row').length, 5);
  assert.equal(app.$$('#homeSessionContent .home-row').length, 3);
  assert.equal($('#homeCards').dataset.cardCount, '6');
  for (const column of ['#homeColumnStart', '#homeColumnEnd']) {
    assert.ok(app.$$(`${column} .home-card`).some((card) => !card.hidden), `${column} holds a card`);
  }
  // Everything is rows (one native button each): no row nests another control.
  for (const row of app.$$('#homeCards .home-row')) {
    assert.equal(row.localName, 'button');
    assert.equal(row.querySelector('button, a, input, select'), null);
  }
  await show(model({ recent: ready([item('a')]) }));
  assert.deepEqual(shownCards().map((card) => card.id).sort(), ['homeNoticedCard', 'homeRecentCard', 'homeSessionCard', 'homeStartCard']);
  assert.equal($('#homeContinueContent').children.length, 0, 'a left-out card keeps no content');
  assert.equal($('#homeNightContent').children.length, 0);
  assert.equal($('#homeReviewContent').children.length, 0);
});

test('the night after: only stored facts, an unknown value is left out, no judging words', async () => {
  await show(model({ nightAfter: { status: 'ready', night }, recent: ready([item('a')]) }));
  assert.equal(text('#homeNightTitle'), 'Friday');
  assert.equal(text('#homeNightEyebrow'), 'The night after');
  assert.deepEqual(app.$$('#homeNightContent .home-tile-label').map((node) => node.textContent), ['Players', 'Transfers to settle', 'Moved in the settle-up']);
  assert.equal($('#homeNightContent [data-home-destination="home-game"]').textContent, 'Open game night');
  await show(model({ nightAfter: { status: 'ready', night: { ...night, transferCount: null, settledText: null } }, recent: ready([item('a')]) }));
  assert.deepEqual(app.$$('#homeNightContent .home-tile-label').map((node) => node.textContent), ['Players'], 'unknown is never shown as zero');
  await show(model({ nightAfter: { status: 'ready', night: { ...night, state: 'active' } }, recent: ready([item('a')]) }));
  assert.equal(text('#homeNightEyebrow'), 'Game night in progress');
  assert.doesNotMatch(text('#homeNightContent'), /blunder|mistake|luck|bad play/i);
});

test('what Riverline noticed: honest empty state, gated items with a source line and a link to their spots', async () => {
  await show(model({ recent: ready([item('a')]) }));
  assert.equal(text('#homeNoticedContent p:first-child'), 'Nothing to report yet.');
  assert.match(text('#homeNoticedContent'), /at least 8 of them/);
  assert.equal(app.$$('#homeNoticedContent .home-noticed-item').length, 0);

  await show(model({ recent: ready([item('a')]), noticed: ready([
    played('plan_vs_played', 7, { id: 'too-small' }),
    played('plan_vs_played', 18, { id: 'ok', destination: 'analyze' }),
    played('drift', 34, { id: 'drift' }),
    played('plan_vs_played', 40, { id: 'drills', source: 'drills' }),
  ]) }));
  const items = app.$$('#homeNoticedContent .home-noticed-item');
  assert.equal(items.length, 2, 'the 7-hand item and the drills item are held back');
  assert.equal(items[0].localName, 'button', 'the whole item links to its spots');
  assert.equal(items[0].dataset.homeDestination, 'analyze');
  assert.match(items[0].getAttribute('aria-label'), /^Look at the spots: /);
  assert.equal(items[0].querySelector('.home-noticed-source').textContent, 'Played hands · your plan · medium sample');
  assert.match(items[0].querySelector('.home-noticed-evidence').textContent, /Played 14 of 18 hands · your plan 45%/);
  assert.equal(items[1].querySelector('.home-noticed-source').textContent, 'Played hands · mixed baseline · large sample');
  assert.equal(items[1].localName, 'div', 'no destination, no link');
  assert.equal(items[0].querySelector('bdi').dir, 'auto');
});

test('no user-facing "heuristic", and Home text is free of verdict words', async () => {
  await show(model({
    continue: ready([{ kind: 'live_hand' }]),
    recent: ready([item('a', { kind: 'spot' })]),
    review: { status: 'ready', reviewLater: ready([item('v1')]), mistakes: ready([]) },
    nightAfter: { status: 'ready', night },
    noticed: ready([played('plan_vs_played', 18)]),
  }));
  const content = text('#homeCards');
  assert.doesNotMatch(content, /heuristic|\bGTO\b|solved|blunder|\bwrong\b|optimal/i);
  await show(model());
  assert.doesNotMatch(text('#homeCards'), /heuristic|\bGTO\b|solved|blunder|\bwrong\b|optimal/i);
});

test('keyboard equivalents: every action is a native button, the Study Inbox is a popover that never moves a card', async () => {
  await show(model({ recent: ready([item('a')]), review: { status: 'ready', reviewLater: ready([item('v1')]), mistakes: ready([]) } }));
  for (const control of app.$$('#homeCards [data-home-destination], #homeCards [data-home-saved-id], #homeCards [data-home-action]')) {
    assert.equal(control.localName, 'button', control.className);
  }
  const inbox = $('#studyInboxPanel');
  assert.equal(inbox.localName, 'details', 'a native disclosure: Enter and Space work');
  assert.ok(inbox.closest('#homeGreeting'), 'it lives in the greeting row, outside the card grid');
  assert.equal($('#homeCards').contains(inbox), false);
  assert.equal(inbox.getAttribute('data-tutorial-anchor'), 'home-study-inbox');
});

test('the greeting names an account, not a guest; the context chip is read-only', async () => {
  await show(model({ personalStrategy: { status: 'ready', selectedProfile: { id: 'p', displayName: 'Home game' }, selectedMode: { id: 'm', displayName: 'Serious' } } }));
  assert.match(text('#homeGreetingTitle'), /^Good (morning|afternoon|evening), Dana$/);
  assert.equal($('#homeContextChip').hidden, false);
  assert.equal(text('#homeContextChip'), 'Home game · Serious');
  assert.equal($('#homeContextChip').localName, 'span', 'not a control: the format toggle comes with Table rules');
  await show(model({}, 'guest'));
  assert.match(text('#homeGreetingTitle'), /^Good (morning|afternoon|evening)$/);
  assert.equal($('#homeContextChip').hidden, true);
});

test('opening motion: cards stagger in reading order, a key press opens instantly, timers are bounded', async () => {
  const winDoc = win.document;
  await app.navigate('analyze');
  winDoc.dispatchEvent(new win.Event('pointerdown'));
  await show(model({ recent: ready([item('a')]), review: { status: 'ready', reviewLater: ready([item('v1')]), mistakes: ready([]) } }));
  assert.ok($('#homeCards').classList.contains('home-cards--enter'), 'pointer opening plays the entrance');
  const orders = shownCards().map((card) => Number(card.style.getPropertyValue('--home-card-order')));
  assert.deepEqual([...orders].sort((a, b) => a - b), orders.map((_, index) => index), 'orders are 0..n-1, once each');
  app.advance(2000);
  assert.equal($('#homeCards').classList.contains('home-cards--enter'), false, 'the timeout, not animationend, clears it');
  await app.navigate('analyze');
  winDoc.dispatchEvent(new win.Event('keydown'));
  await show(model({ recent: ready([item('a')]) }));
  assert.equal($('#homeCards').classList.contains('home-cards--enter'), false, 'keyboard: instant');
});

test('owner isolation A -> B -> sign-out: header, hidden identity, chip and every card clear at once', async () => {
  const headerCalls = [];
  const header = win.RiverlineWorkspaceHeader;
  override('RiverlineWorkspaceHeader', {
    setContext: (...args) => { headerCalls.push(['context', ...args]); return header.setContext(...args); },
    setPlayContext: (...args) => { headerCalls.push(['play', ...args]); return header.setPlayContext?.(...args); },
  });
  const modelFor = (name, mode = 'account') => ({
    ...model({
      recent: ready([item(`${name}-hand`, { title: `${name} secret hand` })]),
      nightAfter: { status: 'ready', night: { ...night, title: `${name} night` } },
      personalStrategy: { status: 'ready', selectedProfile: { id: 'p', displayName: `${name} game` }, selectedMode: { id: 'm', displayName: 'Serious' } },
    }, mode),
    identity: mode === 'guest' ? { status: 'guest', profile: null } : { status: 'ready', profile: { displayName: name, username: name.toLowerCase() } },
  });
  try {
    await show(modelFor('Alice'));
    assert.equal(text('#homeIdentityDisplayName'), 'Alice');
    assert.deepEqual([...win.RiverlineWorkspaceHeader.getContext('home')].slice(0, 1), ['Alice']);
    assert.match(text('#homeCards'), /Alice secret hand/);

    // Owner A -> B: before B's data arrives nothing of A remains anywhere.
    nextModel = new Promise(() => {});
    headerCalls.length = 0;
    win.dispatchEvent(new win.CustomEvent('riverline:identitychange', { detail: {} }));
    assert.equal(text('#homeIdentityDisplayName'), '', 'hidden identity fields are cleared');
    assert.equal(text('#homeIdentityUsername'), '');
    assert.equal(text('#homeGreetingTitle'), '');
    assert.equal(text('#homeContextChip'), '');
    for (const id of ['Continue', 'Session', 'Night', 'Noticed', 'Review', 'Recent']) {
      assert.equal($(`#home${id}Content`).children.length, 0, `${id} keeps no content of the previous owner`);
    }
    assert.doesNotMatch($('#homeWorkspaceContent').textContent, /Alice/);
    assert.deepEqual([...win.RiverlineWorkspaceHeader.getContext('home')], [], 'the header context no longer names A');
    assert.equal(win.RiverlineWorkspaceHeader.getPlayContext(), null, 'the Game/Approach chip is cleared');
    assert.ok(headerCalls.some(([kind, , value]) => kind === 'context' && Array.isArray(value) && value.length === 0));

    nextModel = modelFor('Bob');
    app.advance(200);
    await app.flush();
    assert.equal(text('#homeIdentityDisplayName'), 'Bob');
    assert.deepEqual([...win.RiverlineWorkspaceHeader.getContext('home')].slice(0, 1), ['Bob']);
    assert.match(text('#homeCards'), /Bob secret hand/);
    assert.doesNotMatch(text('#homeCards'), /Alice/);

    // B -> sign-out: the guest view holds nothing of B, hidden DOM included.
    nextModel = new Promise(() => {});
    win.dispatchEvent(new win.CustomEvent('riverline:identitychange', { detail: {} }));
    assert.doesNotMatch($('#homeWorkspaceContent').textContent, /Bob/);
    nextModel = modelFor('Guest', 'guest');
    app.advance(200);
    await app.flush();
    assert.equal(text('#homeIdentityDisplayName'), '', 'the guest render leaves no identity in hidden DOM');
    assert.equal(text('#homeIdentityUsername'), '');
    assert.doesNotMatch($('#homeWorkspaceContent').innerHTML, /Bob|Alice/);
    assert.deepEqual([...win.RiverlineWorkspaceHeader.getContext('home')], ['Guest Mode']);
  } finally {
    originals.get('RiverlineWorkspaceHeader') && Object.defineProperty(win, 'RiverlineWorkspaceHeader', {
      configurable: true, enumerable: false, writable: false, value: originals.get('RiverlineWorkspaceHeader'),
    });
    originals.delete('RiverlineWorkspaceHeader');
  }
});

test('a failed load says so and offers a drill; it never says nothing is due', async () => {
  await show(model({
    recent: { status: 'error' },
    review: { status: 'error', reviewLater: { status: 'error' }, mistakes: { status: 'error' } },
  }));
  assert.equal(text('#homeSessionTitle'), 'Saved items could not be loaded.');
  assert.doesNotMatch(text('#homeSessionCard'), /Nothing is due/);
  assert.equal(primaries().length, 1);
  assert.ok(controller().getModel());
});

test('Start something: real destinations only, label-sized rows, nothing invented', async () => {
  await show(model());
  assert.equal($('#homeStartCard').hidden, false);
  const rows = app.$$('#homeStartContent .home-row');
  assert.deepEqual(rows.map((row) => row.dataset.homeDestination), ['training', 'analyze', 'equity', 'hand', 'home-game']);
  assert.deepEqual(rows.map((row) => row.querySelector('.home-row-title').textContent),
    ['Quick drill', 'Analyze a spot', 'Equity', 'Reconstruct a hand', 'Game night']);
  assert.equal(primaries().length, 1, 'Start something adds no solid button');
  // With five other cards it is left out, and keeps no content.
  await show(model({
    continue: ready([{ kind: 'live_hand' }]),
    recent: ready([item('a')]),
    review: { status: 'ready', reviewLater: ready([item('v')]), mistakes: ready([]) },
    nightAfter: { status: 'ready', night },
  }));
  assert.equal($('#homeStartCard').hidden, true);
  assert.equal($('#homeStartContent').children.length, 0);
  assert.ok(shownCards().length <= 6);
});

test('account view through a FAKE auth provider (no real provider is used): signed in, conflict, then signed out', async () => {
  const { installHomeWorkspaceBridge } = await import('../app/src/application/home-workspace-bootstrap.mjs');
  let auth = { status: 'signed_in', profile: { displayName: 'Fake Owner', username: 'fake_owner' } };
  let sync = { state: 'conflict', enabled: true, pendingCount: 0, conflictCount: 2, errorCount: 0 };
  const authentication = { ready: async () => {}, getState: () => auth };
  const empty = async () => [];
  const target = {};
  const bridge = installHomeWorkspaceBridge(target, {
    authentication,
    playbookBridge: win.RiverlinePlaybookState,
    savedStudyQueries: { listRecent: async () => [], listForReview: empty, listMistakes: empty, getById: async () => null },
    personalStrategyQueries: { loadSummary: async () => ({ profileCount: 0, selectedProfile: null, selectedMode: null, context: null, answeredCount: 0, totalCount: 0, session: null, resumable: false }) },
    syncQueries: { getState: () => sync },
    continuationQueries: { getSummary: () => ({ hasLiveHand: false }) },
    gameNightQueries: { getLatest: async () => null },
  });
  assert.ok(bridge && target.RiverlineHome, 'a bridge built around the fake provider');
  nextModel = await bridge.load();
  assert.equal(nextModel.sessionMode, 'account');
  await show(nextModel);
  assert.equal($('#homeAccountOverview').hidden, false);
  assert.equal($('#homeGuestAccount').hidden, true);
  assert.equal(text('#homeIdentityDisplayName'), 'Fake Owner');
  assert.equal(text('#homeIdentityUsername'), '@fake_owner');
  assert.equal(text('#homeSyncStatusLabel'), 'Conflict needs attention');
  assert.equal($('#homeSyncReview').hidden, false);
  assert.match(text('#homeGreetingTitle'), /, Fake Owner$/);
  assert.equal($('#homeAccountOverview').getAttribute('data-tutorial-anchor'), 'home-overview');
  assert.equal(primaries().length, 1);
  // Sign-out: the same bridge now answers as a guest, and nothing of the owner stays in the DOM.
  auth = { status: 'signed_out', profile: null };
  nextModel = await bridge.load();
  assert.equal(nextModel.sessionMode, 'guest');
  await show(nextModel);
  assert.equal($('#homeAccountOverview').hidden, true);
  assert.equal(text('#homeIdentityDisplayName'), '');
  assert.doesNotMatch($('#homeWorkspaceContent').innerHTML, /Fake Owner|fake_owner/);
});
