import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { appStyleSheet, bootApp, indexDocument, precedes } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, the running Hand workspace and rendered table,
// the cascade). Renderer, presentation and Training bridge sources are outside
// this ticket and keep their checks.
const renderer = readFileSync(new URL('../app/src/ui/TableRenderer.js', import.meta.url), 'utf8');
const presentation = readFileSync(
  new URL('../app/src/application/table-presentation.mjs', import.meta.url),
  'utf8',
);
const trainingBridge = readFileSync(
  new URL('../app/src/application/training-mode-bootstrap.mjs', import.meta.url),
  'utf8',
);
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const legalButtons = () => app.$$('#handLegalActions [data-canonical-action]');

test('visible Hand composition is table-first with one adjacent action and replay rail', async () => {
  // Protects: table, interaction rail, stage dock, history and timeline in
  // that order; sizing has range + number + commit controls; the rail is a grid
  // when shown; compact/review timelines scroll internally; Hand reserves a
  // stable scrollbar gutter; the sizing panel sits on the inset surface.
  const order = ['table-wrapper', 'handInteractionRail', 'handStageDock', 'handHistorySection', 'handTimelineStage']
    .map((id) => markup.getElementById(id));
  order.slice(1).forEach((node, index) => assert.ok(precedes(order[index], node), `${order[index].id} before ${node.id}`));
  assert.equal(markup.getElementById('handActionAmountRange').type, 'range');
  assert.equal(markup.getElementById('handActionAmountBb').type, 'number');
  assert.equal(markup.getElementById('handCommitSizedAction').type, 'button');

  await app.startHand(['As', 'Kd']);
  const rail = app.byId('handInteractionRail');
  const wasHidden = rail.hidden;
  rail.hidden = false;
  assert.equal(css.cascaded(rail, 'display'), 'grid');
  rail.hidden = wasHidden;
  const history = app.byId('handActionHistory');
  for (const variant of ['replay-timeline--compact', 'replay-timeline--review']) {
    const previous = history.className;
    history.className = `replay-timeline ${variant}`;
    assert.equal(css.cascaded(history, 'overflow-y'), 'auto', variant);
    history.className = previous;
  }
  assert.ok(app.byId('gtoMode').classList.contains('active'));
  assert.equal(css.cascaded(app.document.documentElement, 'scrollbar-gutter'), 'stable');
  await app.navigate('home');
  assert.notEqual(css.cascaded(app.document.documentElement, 'scrollbar-gutter'), 'stable', 'only while Hand is open');
  assert.equal(css.cascaded(markup.querySelector('.hand-action-sizing'), 'background'), 'var(--surface-inset)');
});

test('duplicate Hand submissions lock before the canonical transition and sizing uses canonical bounds', async () => {
  // Protects: a locked draft refuses actions; the lock is taken before the
  // canonical transition; buttons render disabled while locked; a second click
  // on the same control is ignored; sizing uses the canonical min/max and chip unit.
  await app.startHand(['As', 'Kd']);
  const draft = app.window.app.playbookHandDraft;
  const lockAtTransition = [];
  const original = app.window.callPlaybookStateBridge;
  app.window.callPlaybookStateBridge = (method, ...args) => {
    if (method === 'applyAction') lockAtTransition.push(draft.actionSubmissionLocked);
    return original(method, ...args);
  };
  try {
    draft.actionSubmissionLocked = true;
    assert.equal(app.call('applyCanonicalHandAction', 'call'), null);
    app.call('renderCanonicalHandWorkspace');
    assert.ok(legalButtons().length > 0 && legalButtons().every((button) => button.disabled));
    draft.actionSubmissionLocked = false;
    app.call('renderCanonicalHandWorkspace');
    const call = app.$('#handLegalActions [data-canonical-action="call"]');
    const before = app.call('callPlaybookStateBridge', 'getState').actionHistory?.length;
    call.click();
    call.click();
    await app.settle(300);
    assert.deepEqual(lockAtTransition, [true], 'one transition, taken under the lock');
    assert.equal(app.call('callPlaybookStateBridge', 'getState').actionHistory.length, before + 1);
  } finally {
    app.window.callPlaybookStateBridge = original;
  }

  const state = app.call('callPlaybookStateBridge', 'getState');
  const sized = legalButtons().find((button) => ['bet', 'raise'].includes(button.dataset.canonicalAction));
  assert.ok(sized, 'a sized action is offered');
  const option = app.call('callPlaybookStateBridge', 'getLegalActions')[sized.dataset.canonicalAction];
  await app.click(sized);
  const range = app.byId('handActionAmountRange');
  const amount = app.byId('handActionAmountBb');
  assert.equal(Number(amount.min), Number(option.minToMilliBb) / 1000);
  assert.equal(Number(amount.max), Number(option.maxToMilliBb) / 1000);
  assert.equal(Number(amount.step), Number(state.game?.chipUnitMilliBb || 100) / 1000);
  assert.equal(range.min, amount.min);
  assert.equal(range.max, amount.max);
});

test('Replay seeking and compact Analyze projection reuse the application bridges', async () => {
  // Protects: timeline seek controls select frames through the Playbook bridge;
  // Analyze asks the bridge for a passive 'analyze' table projection.
  await app.startHand(['As', 'Kd']);
  await app.handAction('call');
  const seeks = app.$$('.replay-timeline-seek[data-frame-index]');
  assert.ok(seeks.length >= 2);
  const calls = [];
  const original = app.window.callPlaybookStateBridge;
  app.window.callPlaybookStateBridge = (method, ...args) => { calls.push([method, ...args]); return original(method, ...args); };
  try {
    await app.click(seeks[0]);
    assert.ok(calls.some(([method, frame]) => method === 'selectReplayFrame' && frame === Number(seeks[0].dataset.frameIndex)));
    calls.length = 0;
    app.byId('gtoMode').dataset.productDestination = 'analyze';
    app.call('dispatchCanonicalTableState');
    const [, options] = calls.find(([method]) => method === 'createTablePresentationViewModel');
    assert.equal(options.projection, 'analyze');
    assert.equal(options.interaction, 'passive');
  } finally {
    app.window.callPlaybookStateBridge = original;
    await app.navigate('hand');
  }
  assert.match(trainingBridge, /snapshot\.currentDecision\.legalActions/);
  assert.match(trainingBridge, /createReplayTimelineViewModel/);
});

test('theme, card, density, layout, RTL, and reduced-motion authorities remain compatible', async () => {
  // Protects: the rendered table uses theme table tokens; compact density and
  // layout presets size the play projection; review/analyze/saved projections
  // are styled; the poker canvas stays LTR in RTL; seats do not animate under
  // reduced motion; projected tables are never height-capped.
  assert.match(renderer, /RiverlineCardPresentation/);
  assert.match(renderer, /RiverlinePokerPrimitives/);
  await app.startHand(['As', 'Kd']);
  const table = app.$('#visual-table-container .riverline-poker-table');
  assert.ok(table, 'the SVG table renders');
  const uses = (token) => app.$$('#visual-table-container *').some((node) => css.matchingRules(node)
    .some((rule) => rule.declarations.some((declaration) => declaration.value.includes(`var(${token})`))));
  assert.ok(uses('--poker-table-rail-end'), 'rail gradient token');
  assert.ok(uses('--poker-table-seat-hero'), 'Hero seat token');
  const container = app.byId('visual-table-container');
  const root = app.document.documentElement;
  root.dataset.density = 'compact';
  assert.equal(css.cascaded(container, '--play-stage-reserve'), '420px');
  root.dataset.density = 'comfortable';
  assert.ok(root.hasAttribute('data-layout-preset'));
  assert.ok(css.matchingRules(container).some((rule) => rule.selectorText.includes('html[data-layout-preset]') && rule.selectorText.includes('data-table-projection="play"')));
  for (const projection of ['review', 'analyze', 'saved_preview']) {
    const probe = app.document.createElement('div');
    probe.id = 'visual-table-container';
    probe.dataset.tableProjection = projection;
    const wrapper = app.document.createElement('div');
    wrapper.className = 'table-wrapper';
    wrapper.dataset.tableProjection = projection;
    wrapper.appendChild(probe);
    app.byId('gtoMode').appendChild(wrapper);
    assert.ok([probe, wrapper].some((node) => css.matchingRules(node).some((rule) => rule.selectorText.includes(`data-table-projection="${projection}"`))), projection);
    wrapper.remove();
  }
  root.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(table, 'direction'), 'ltr');
  root.setAttribute('dir', 'ltr');
  const unit = app.$('#visual-table-container .table-player-unit');
  assert.ok(unit, 'the table renders player units');
  const motion = css.cascaded(unit, 'transition', { reducedMotion: true }) ?? css.cascaded(unit, 'animation', { reducedMotion: true });
  assert.match(motion || 'none', /none/);
  const wrapper = app.byId('table-wrapper');
  assert.ok(wrapper.dataset.tableProjection);
  assert.equal(css.cascaded(wrapper, 'max-height'), 'none');
});

test('presentation and renderer introduce no strategy, legality, or accounting authority', () => {
  assert.doesNotMatch(
    presentation,
    /StrategyProvider|StrategyResult|probability|frequency|calculateEquity|applyAction|getLegalActionSpec|shared\/poker-domain/i,
  );
  assert.doesNotMatch(renderer, /shared\/poker-domain|StrategyProvider|calculateEquity/);
  assert.doesNotMatch(
    renderer,
    /potMilliBb\s*[-+*/]|streetContributionMilliBb\s*[-+*/]|currentStackMilliBb\s*[-+*/]/,
  );
  assert.doesNotMatch(`${presentation}\n${renderer}`, /setInterval|requestAnimationFrame/);
});
