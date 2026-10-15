import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';


import { appStyleSheet, bootApp, indexDocument, precedes, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural: the parsed header/rail, the cascade, and the running shell's
// header context, descriptions, emphasis and tooltips. Header-module, tutorial,
// Home Game, i18n and saved-library sources are outside this ticket.
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const bootErrors = [...app.errors];
// Imported after boot: the module installs the page's header bridge on load.
const {
  MODE_SWITCH_DESTINATIONS,
  WORKSPACE_HEADER_SCHEMA_VERSION,
  createWorkspaceHeaderController,
  formatWorkspaceContext,
  shouldShowSourceBadge,
} = await import('../app/src/application/workspace-header.mjs');
const header = markup.querySelector('header.workspace-header');
const rail = markup.getElementById('modeRail');
const headerApi = () => app.window.RiverlineWorkspaceHeader;
const headerModule = read('../app/src/application/workspace-header.mjs');
const tutorialBootstrap = read('../app/src/application/tutorial-bootstrap.mjs');
const homeGame = read('../app/src/application/home-game-bootstrap.mjs');

test('the header bar holds a title and context line, then mode switch, source badge, Learn, Help and Account', () => {
  assert.equal(WORKSPACE_HEADER_SCHEMA_VERSION, 'workspace-header/v1');
  const heading = header.querySelector('.workspace-heading');
  const [title, context] = heading.children;
  assert.equal(title.localName, 'h1');
  assert.equal(title.id, 'workspaceTitle');
  assert.equal(text(title), 'Home');
  assert.equal(context.id, 'workspaceContext');
  assert.ok(context.classList.contains('workspace-context'));
  assert.equal(context.hidden, true);
  assert.equal(text(context), '');
  assert.equal(header.querySelector('.workspace-eyebrow, #workspaceSubtitle, [data-tutorial-anchor="home-overview"]'), null);
  const order = ['workspaceModeSwitch', 'strategySourceStatus', 'workspaceLearnButton', 'workspaceTutorialButton', 'accountHeaderControl']
    .map((id) => header.querySelector(`#${id}`));
  assert.ok(order.every(Boolean), 'every end-side control is in the header');
  order.slice(1).forEach((node, index) => assert.ok(precedes(order[index], node), node.id));
  const help = header.querySelector('#workspaceTutorialButton');
  assert.equal(help.getAttribute('aria-label'), 'Help');
  assert.equal(help.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(css.cascaded(markup.documentElement, '--header-bar-height'), '56px');
  assert.equal(css.cascaded(header, 'block-size'), 'var(--header-bar-height)');
  // The header starts where the canvas frame starts (same start edge).
  assert.equal(css.cascaded(header, 'padding-inline-start') ?? css.cascaded(header, 'padding-inline'), 'max(var(--gutter-canvas), calc((100% - var(--canvas-max)) / 2))');
  assert.equal(css.cascaded(markup.querySelector('.workspace-canvas'), 'padding-inline-start') ?? css.cascaded(markup.querySelector('.workspace-canvas'), 'padding-inline'), 'var(--gutter-canvas)');
  // RTL mirrors generic headers but never the workspace header bar.
  const generic = markup.createElement('header');
  markup.body.appendChild(generic);
  markup.documentElement.setAttribute('dir', 'rtl');
  assert.equal(css.cascaded(generic, 'flex-direction'), 'row-reverse');
  assert.notEqual(css.cascaded(header, 'flex-direction'), 'row-reverse');
  markup.documentElement.setAttribute('dir', 'ltr');
  generic.remove();
});

test('the Hand/Scenario mode switch lives only in the header and only for Hand and Analyze', async () => {
  assert.deepEqual([...MODE_SWITCH_DESTINATIONS], ['hand', 'analyze']);
  assert.equal(markup.querySelectorAll('#playbookModeControl').length, 1);
  const modeSwitch = header.querySelector('#workspaceModeSwitch');
  assert.equal(modeSwitch.dataset.tutorialAnchor, 'playbook-workflow');
  assert.equal(modeSwitch.hidden, true);
  assert.ok(precedes(modeSwitch.querySelector('#playbookScenarioMode'), modeSwitch.querySelector('#playbookHandMode')));
  assert.equal(markup.querySelector('#playbookWorkflowKicker, #playbookWorkflowTitle'), null);
  // The authority/status line stays in the Playbook view and stays live.
  const status = markup.querySelector('.playbook-state-source').firstElementChild;
  assert.equal(status.id, 'playbookModeStatus');
  assert.ok(status.classList.contains('playbook-mode-status'));
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  for (const destination of ['hand', 'analyze', 'training', 'equity', 'home']) {
    await app.navigate(destination);
    assert.equal(app.byId('workspaceModeSwitch').hidden, !['hand', 'analyze'].includes(destination), destination);
  }
});

test('the source badge appears only where strategy content is shown', async () => {
  const rule = (state) => shouldShowSourceBadge(state);
  assert.equal(rule({ destination: 'analyze' }), false, 'Analyze names its source above the verdict');
  assert.equal(rule({ destination: 'hand' }), false, 'never during live Hand play');
  assert.equal(rule({ destination: 'hand', handReviewOpen: true }), true);
  assert.equal(rule({ destination: 'training' }), false, 'no badge before an answer');
  assert.equal(rule({ destination: 'training', trainingFullHandPhase: 'live' }), false);
  assert.equal(rule({ destination: 'training', trainingFullHandPhase: 'complete' }), false);
  assert.equal(rule({ destination: 'training', trainingFeedbackShown: true }), true);
  assert.equal(rule({ destination: 'training', trainingFullHandPhase: 'review' }), true);
  assert.equal(rule({ destination: 'personal-strategy' }), false);
  assert.equal(rule({ destination: 'personal-strategy', personalComparisonOpen: true }), true);
  for (const destination of ['home', 'saved', 'equity', 'home-game', 'guide', null]) {
    assert.equal(rule({ destination, handReviewOpen: true, trainingFeedbackShown: true, personalComparisonOpen: true }), false, destination);
  }
  const badge = header.querySelector('#strategySourceStatus');
  assert.equal(badge.className, 'strategy-source-status ui-badge');
  assert.equal(badge.dataset.variant, 'source');
  assert.equal(badge.hidden, true);
  // The rule reads presentation state only; it never calls strategy or Equity.
  assert.doesNotMatch(headerModule, /StrategyProvider|strategyProvider|resolveStrategy|calculateEquity|RiverlineEquity|DecisionContext|callPlaybookStateBridge/);
  // Reveal timing is untouched: Full Hand keeps the badge hidden until review.
  await app.training.start('full_hand');
  await app.settle(300);
  assert.equal(app.byId('strategySourceStatus').hidden, true, 'hidden during a live Full Hand');
  await app.training.playFullHand();
  assert.equal(app.byId('strategySourceStatus').hidden, true, 'hidden at completion');
  await app.click('#trainingReviewHand');
  await app.settle(300);
  assert.equal(app.byId('strategySourceStatus').hidden, false, 'shown in Full Hand review');
  await app.navigate('home');
});

test('the context line joins already-rendered facts for the active workspace only', async () => {
  assert.equal(formatWorkspaceContext(['Scenario', ' BTN ', '', null, '100 bb']), 'Scenario · BTN · 100 bb');
  const nodes = [];
  const element = (id) => ({ id, hidden: false, dataset: {}, children: [], textContent: '', replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); } });
  const elements = { '#workspaceContext': element('workspaceContext'), '#workspaceTitle': element('workspaceTitle'), '#strategySourceStatus': element('badge'), '#workspaceModeSwitch': element('switch') };
  const document = {
    querySelector: (selector) => elements[selector] ?? null,
    createElement: (tag) => { const node = { tag, textContent: '' }; nodes.push(node); return node; },
  };
  const controller = createWorkspaceHeaderController({ document, translate: (key) => `t:${key}`, schedule: () => 1 });
  controller.setContext('hand', ['6 players · Hero BTN · 100 bb', 'Preflop']);
  controller.activate('analyze', { titleKey: 'Analyze', descriptionKey: 'Analyze help' });
  assert.equal(elements['#workspaceTitle'].textContent, 't:Analyze');
  assert.equal(elements['#workspaceContext'].hidden, true, 'no facts yet for Analyze');
  assert.equal(elements['#workspaceModeSwitch'].hidden, false);
  assert.equal(elements['#strategySourceStatus'].hidden, true, 'Analyze shows provenance above the verdict only');
  controller.activate('hand', { titleKey: 'Hand', descriptionKey: 'Hand help' });
  assert.equal(elements['#workspaceContext'].hidden, false);
  const facts = elements['#workspaceContext'].children.filter((child) => typeof child === 'object');
  assert.deepEqual(facts.map((fact) => [fact.tag, fact.textContent]), [['bdi', '6 players · Hero BTN · 100 bb'], ['bdi', 'Preflop']]);
  assert.equal(controller.getDescription(), 'Hand help');
  controller.setDescription('hand', 'Override');
  assert.equal(controller.getDescription('hand'), 'Override');
  controller.activate('equity', { titleKey: 'Equity' });
  assert.equal(elements['#workspaceModeSwitch'].hidden, true);
  assert.equal(elements['#strategySourceStatus'].hidden, true);
  // In the running app each workspace publishes facts its renderers already
  // show; the line follows the active workspace.
  await app.startHand(['As', 'Kd']);
  const handFacts = app.$$('#workspaceContext bdi').map((node) => text(node));
  assert.equal(handFacts.length, 2, 'hand summary and street');
  assert.match(handFacts.join(' '), /Preflop/i);
  await app.navigate('equity');
  assert.deepEqual(app.$$('#workspaceContext bdi').map((node) => text(node)), [`${app.window.app.equity.players.length} players`]);
  for (const destination of ['analyze', 'training', 'saved']) {
    await app.navigate(destination);
    assert.ok(Array.isArray(headerApi().getContext(destination)), destination);
  }
  assert.match(homeGame, /setContext\('home-game', \[refs\.persistence\.textContent, state\.current\?\.session\.title \|\| ''\]\)/);
});

test('the workspace description moved from the header into the Help panel', async () => {
  assert.match(tutorialBootstrap, /openChooser\(manualButton\.dataset\.tutorialWorkspace, manualButton, \{ help: helpContent\(\) \}\)/);
  assert.match(tutorialBootstrap, /button\.hidden = workspace === 'settings';/);
  const buttons = rail.querySelectorAll('button.mode-nav-item');
  for (const button of buttons) assert.ok(button.dataset.modeSubtitle, `${button.dataset.navigationId} keeps its description for Help`);
  // Navigation hands the button's description to the header for Help.
  for (const destination of ['analyze', 'training', 'equity']) {
    await app.navigate(destination);
    const button = app.$(`.mode-nav-item[data-navigation-id="${destination}"]`);
    assert.equal(headerApi().getDescription(destination), button.dataset.modeSubtitle, destination);
  }
  await app.navigate('home');
  await app.settle(300);
  assert.equal(headerApi().getDescription('home'), 'Your learning workspace is saved on this device.');
});

test('one accent-filled action per view in the key states', async () => {
  // Hand: legal actions are peers; Replay transport and New hand are secondary.
  await app.startHand(['As', 'Kd']);
  const legal = app.$$('[data-canonical-action]').filter((button) => button.closest('.hand-legal-actions'));
  assert.ok(legal.length >= 2);
  for (const button of legal) assert.equal(button.className, 'ui-button ui-button--secondary', button.dataset.canonicalAction);
  assert.ok(markup.getElementById('handReplayPlaybackButton').classList.contains('ui-button--secondary'));
  const review = markup.getElementById('handCompletedReviewButton');
  const newHand = markup.getElementById('handCompletedNewHandButton');
  let completion = review.parentElement;
  while (!completion.contains(newHand)) completion = completion.parentElement;
  assert.equal(completion.querySelectorAll('.ui-button--primary').length, 1, 'Review hand is the completion primary');
  assert.ok(review.classList.contains('ui-button--primary'));
  assert.ok(markup.getElementById('handReviewAnalyze').classList.contains('ui-button--secondary'));
  // Home: only the first continuation leads.
  await app.navigate('home');
  app.call('renderHomeContinue', { status: 'ready', items: [
    { kind: 'range_calibration', profileName: 'P', modeName: 'M', answeredCount: 1, totalCount: 169 },
    { kind: 'live_hand' },
  ] });
  const resumes = app.$$('#homeContinueContent .home-calibration-actions .ui-button');
  assert.deepEqual(resumes.map((button) => button.className), ['ui-button ui-button--primary', 'ui-button ui-button--secondary']);
  // Training: Start leads before a session, Next exercise after an answer.
  await app.navigate('training');
  app.call('clearTrainingSessionState');
  assert.ok(app.byId('trainingNewHand').classList.contains('ui-button--primary'));
  await app.training.start('focused');
  await app.training.answer();
  assert.ok(app.byId('trainingNextHandBtn').classList.contains('ui-button--primary'));
  assert.ok(app.byId('trainingNewHand').classList.contains('ui-button--secondary'));
  // Home Game: with a session open, Complete session leads.
  assert.match(homeGame, /refs\.createButton\?\.classList\?\.toggle\('ui-button--primary', !state\.current\)/);
  // The tutorial offer never competes with a workspace primary.
  assert.match(tutorialBootstrap, /start\.className = 'ui-button ui-button--secondary';/);
  // Selected segments/tabs stay underline-style (DS), so the header switch adds no fill.
  const modeSwitch = markup.getElementById('workspaceModeSwitch');
  for (const node of [modeSwitch, ...modeSwitch.querySelectorAll('*')]) {
    assert.doesNotMatch(css.cascaded(node, 'background') || '', /var\(--accent-primary/, node.id || node.className);
  }
  await app.navigate('home');
});

test('sidebar footer is one icon row and nav items carry no self-tooltips (QA-SWEEP-029)', async () => {
  const footer = rail.querySelector('.rail-utilities');
  for (const id of ['langToggle', 'audioToggleBtn', 'openSettings']) assert.ok(footer.querySelector(`#${id}`), id);
  assert.equal(footer.querySelectorAll('.rail-utility-label.sr-only').length, 3, 'labels stay for assistive technology');
  const language = footer.querySelector('label.rail-utility.rail-language');
  assert.equal(language.getAttribute('for'), 'langToggle');
  assert.equal(language.dataset.tooltip, 'Language');
  assert.equal(language.dataset.i18nTooltip, 'Language');
  assert.equal(css.cascaded(footer, 'display'), 'flex');
  const shell = markup.querySelector('.riverline-shell');
  shell.classList.add('is-sidebar-collapsed');
  assert.equal(css.cascaded(footer, 'flex-direction'), 'column');
  shell.classList.remove('is-sidebar-collapsed');
  for (const item of rail.querySelectorAll('.mode-nav-item')) {
    for (const attribute of ['title', 'data-tooltip', 'data-i18n-title']) assert.equal(item.hasAttribute(attribute), false, `${item.dataset.navigationId} ${attribute}`);
  }
  // Collapsing gives nav items their label as a tooltip; expanding removes it.
  await app.click('#sidebarCollapseBtn');
  const item = app.$('.mode-nav-item[data-navigation-id="training"]');
  assert.equal(item.dataset.tooltip, item.dataset.i18nAriaLabel || item.dataset.modeTitle);
  await app.click('#sidebarCollapseBtn');
  assert.equal(item.dataset.tooltip, undefined);
  assert.match(read('../app/src/locales/i18n.js'), /\['data-i18n-tooltip', 'data-tooltip'\]/);
});

test('RU and HE name Home and Home Game differently (QA-SWEEP-014)', () => {
  const context = { window: {} };
  context.window = context;
  vm.runInNewContext(read('../app/src/locales/product-translations.js'), context);
  vm.runInNewContext(read('../app/src/locales/home-game-translations.js'), context);
  const product = context.riverlineProductTranslations;
  const homeGameCatalog = context.riverlineHomeGameTranslations;
  for (const language of ['ru', 'he']) {
    assert.ok(product[language].Home, `${language} Home`);
    assert.notEqual(product[language].Home, homeGameCatalog[language]['Home Game'], language);
  }
  assert.equal(product.ru.Home, 'Главная');
  assert.equal(product.he.Home, 'דף הבית');
});

test('Home has no Destinations panel and links Review Mistakes from the Review header', async () => {
  const home = markup.getElementById('homeMode');
  assert.equal(home.querySelector('.home-destinations-rail, .home-quick-links, #homeQuickStartTitle'), null);
  const link = home.querySelector('#homeReviewMistakesLink');
  const head = link.parentElement;
  assert.ok(head.matches('header.home-section-head'));
  assert.equal(head.firstElementChild.localName, 'div');
  assert.ok(head.firstElementChild.querySelector('#homeReviewTitle'));
  assert.equal(link.dataset.homeDestination, 'review_mistakes');
  assert.equal(link.hidden, true);
  // Shown only when the model offers it; it opens Saved filtered to mistakes.
  await app.navigate('home');
  await app.settle(300);
  assert.equal(app.byId('homeReviewMistakesLink').hidden, true, 'guest Home does not offer it');
  const loaded = await app.call('callHomeBridge', 'load');
  const model = { ...loaded, sections: { ...loaded.sections, quickStart: { ...loaded.sections.quickStart, destinations: [...(loaded.sections.quickStart?.destinations || []), 'review_mistakes'] } } };
  app.call('renderHomeWorkspace', model);
  assert.equal(app.byId('homeReviewMistakesLink').hidden, false);
  const spy = app.spy(['navigateToProductDestination']);
  try {
    await app.click('#homeReviewMistakesLink');
    assert.deepEqual(spy.calls.navigateToProductDestination[0], ['saved']);
  } finally {
    spy.restore();
  }
  assert.equal(app.$('.riverline-shell').dataset.activeDestination, 'saved');
  assert.match(read('../app/src/application/saved-library-workspace.mjs'), /showMistakesOnly\(\) \{[\s\S]*?query = createSavedLibraryQuery\(\{ mistakesOnly: true \}\)/);
  await app.navigate('home');
});

test('header context publishers are safe during synchronous init (no top-level const in TDZ)', () => {
  // logic.js runs init() during script evaluation; a publisher that read a
  // top-level const declared later aborted init in development. Behaviour:
  // the app boots without errors, and the Training and Hand publishers run.
  assert.deepEqual(bootErrors, []);
  assert.doesNotThrow(() => app.call('publishTrainingHeaderContext'));
  assert.ok(Array.isArray(headerApi().getContext('training')));
  assert.equal(app.evaluate('typeof handHeaderFacts'), 'object');
});
