import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  MODE_SWITCH_DESTINATIONS,
  WORKSPACE_HEADER_SCHEMA_VERSION,
  createWorkspaceHeaderController,
  formatWorkspaceContext,
  shouldShowSourceBadge,
} from '../app/src/application/workspace-header.mjs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../app/index.html');
const css = read('../app/styles.css');
const logic = read('../app/src/core/logic.js');
const headerModule = read('../app/src/application/workspace-header.mjs');
const tutorialBootstrap = read('../app/src/application/tutorial-bootstrap.mjs');
const homeGame = read('../app/src/application/home-game-bootstrap.mjs');
const headerHtml = html.slice(html.indexOf('<header class="workspace-header"'), html.indexOf('</header>', html.indexOf('<header class="workspace-header"')) + 9);
const railHtml = html.slice(html.indexOf('<aside id="modeRail"'), html.indexOf('</aside>') + 8);

test('the header bar holds a title and context line, then mode switch, source badge, Learn, Help and Account', () => {
  assert.equal(WORKSPACE_HEADER_SCHEMA_VERSION, 'workspace-header/v1');
  assert.match(headerHtml, /<div class="workspace-heading">\s*<h1 id="workspaceTitle"[^>]*>Home<\/h1>\s*<p id="workspaceContext" class="workspace-context" hidden><\/p>/);
  assert.doesNotMatch(headerHtml, /workspace-eyebrow|id="workspaceSubtitle"|data-tutorial-anchor="home-overview"/);
  const order = ['id="workspaceModeSwitch"', 'id="strategySourceStatus"', 'id="workspaceLearnButton"', 'id="workspaceTutorialButton"', 'id="accountHeaderControl"']
    .map((marker) => headerHtml.indexOf(marker));
  assert.ok(order.every((index) => index > 0), 'every end-side control is in the header');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'end-side order is stable');
  assert.match(headerHtml, /id="workspaceTutorialButton"[^>]*aria-label="Help"[^>]*aria-haspopup="dialog"/);
  assert.match(css, /--header-bar-height: 56px/);
  assert.match(css, /SHELL-001: shell composition[\s\S]*?\.workspace-header \{[^}]*block-size: var\(--header-bar-height\)/);
  // The header starts where the canvas frame starts (same start edge).
  assert.match(css, /\.workspace-header \{[^}]*padding-inline: max\(var\(--gutter-canvas\), calc\(\(100% - var\(--canvas-max\)\) \/ 2\)\)/);
  assert.match(css, /\.workspace-canvas \{[^}]*padding-inline: var\(--gutter-canvas\)/);
  assert.match(css, /\[dir="rtl"\] header:not\(\.workspace-header\)/);
});

test('the Hand/Scenario mode switch lives only in the header and only for Hand and Analyze', () => {
  assert.deepEqual([...MODE_SWITCH_DESTINATIONS], ['hand', 'analyze']);
  assert.equal((html.match(/id="playbookModeControl"/g) || []).length, 1);
  assert.match(headerHtml, /id="workspaceModeSwitch"[^>]*data-tutorial-anchor="playbook-workflow"[^>]*hidden>[\s\S]*?id="playbookScenarioMode"[\s\S]*?id="playbookHandMode"/);
  assert.doesNotMatch(html, /id="playbookWorkflowKicker"|id="playbookWorkflowTitle"/);
  // The authority/status line stays in the Playbook view and stays live.
  assert.match(html, /<div class="playbook-state-source"[^>]*>\s*<p id="playbookModeStatus" class="playbook-mode-status" role="status" aria-live="polite"/);
});

test('the source badge appears only where strategy content is shown', () => {
  const rule = (state) => shouldShowSourceBadge(state);
  assert.equal(rule({ destination: 'analyze' }), true);
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
  assert.match(headerHtml, /id="strategySourceStatus" class="strategy-source-status ui-badge" data-variant="source"[^>]*hidden/);
  // The rule reads presentation state only; it never calls strategy or Equity.
  assert.doesNotMatch(headerModule, /StrategyProvider|strategyProvider|resolveStrategy|calculateEquity|RiverlineEquity|DecisionContext|callPlaybookStateBridge/);
  // Reveal timing is untouched: Training feedback and Full Hand review keep their gates.
  assert.match(logic, /fullHandReviewUnlocked = session\?\.mode === 'full_hand'/);
});

test('the context line joins already-rendered facts for the active workspace only', () => {
  assert.equal(formatWorkspaceContext(['Scenario', ' BTN ', '', null, '100 bb']), 'Scenario · BTN · 100 bb');
  const nodes = [];
  const element = (id) => ({ id, hidden: false, dataset: {}, children: [], textContent: '', replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); } });
  const elements = { '#workspaceContext': element('workspaceContext'), '#workspaceTitle': element('workspaceTitle'), '#strategySourceStatus': element('badge'), '#workspaceModeSwitch': element('switch') };
  const document = {
    querySelector: (selector) => elements[selector] ?? null,
    createElement: (tag) => { const node = { tag, textContent: '' }; nodes.push(node); return node; },
  };
  const header = createWorkspaceHeaderController({ document, translate: (key) => `t:${key}`, schedule: () => 1 });
  header.setContext('hand', ['6 players · Hero BTN · 100 bb', 'Preflop']);
  header.activate('analyze', { titleKey: 'Analyze', descriptionKey: 'Analyze help' });
  assert.equal(elements['#workspaceTitle'].textContent, 't:Analyze');
  assert.equal(elements['#workspaceContext'].hidden, true, 'no facts yet for Analyze');
  assert.equal(elements['#workspaceModeSwitch'].hidden, false);
  assert.equal(elements['#strategySourceStatus'].hidden, false);
  header.activate('hand', { titleKey: 'Hand', descriptionKey: 'Hand help' });
  assert.equal(elements['#workspaceContext'].hidden, false);
  const facts = elements['#workspaceContext'].children.filter((child) => typeof child === 'object');
  assert.deepEqual(facts.map((fact) => [fact.tag, fact.textContent]), [['bdi', '6 players · Hero BTN · 100 bb'], ['bdi', 'Preflop']]);
  assert.equal(header.getDescription(), 'Hand help');
  header.setDescription('hand', 'Override');
  assert.equal(header.getDescription('hand'), 'Override');
  header.activate('equity', { titleKey: 'Equity' });
  assert.equal(elements['#workspaceModeSwitch'].hidden, true);
  assert.equal(elements['#strategySourceStatus'].hidden, true);
  // Contexts come from existing renderers; none of them computes new facts.
  for (const marker of [
    "setContext('hand', [handHeaderFacts.summary, handHeaderFacts.street])",
    "window.RiverlineWorkspaceHeader?.setContext('analyze', [",
    "window.RiverlineWorkspaceHeader?.setContext('training', [",
    "window.RiverlineWorkspaceHeader?.setContext('equity', [t('{count} players', { count: app.equity.players.length })])",
    "publishContext: (parts) => window.RiverlineWorkspaceHeader?.setContext('saved', parts)",
  ]) assert.ok(logic.includes(marker), marker);
  assert.match(homeGame, /setContext\('home-game', \[refs\.persistence\.textContent, state\.current\?\.session\.title \|\| ''\]\)/);
});

test('the workspace description moved from the header into the Help panel', () => {
  assert.match(logic, /header\.activate\(button\.dataset\.navigationId, \{ titleKey, descriptionKey \}\)/);
  assert.match(logic, /RiverlineWorkspaceHeader\?\.setDescription\('home', guest/);
  assert.match(tutorialBootstrap, /openChooser\(manualButton\.dataset\.tutorialWorkspace, manualButton, \{ help: helpContent\(\) \}\)/);
  assert.match(tutorialBootstrap, /button\.hidden = workspace === 'settings';/);
  for (const button of html.match(/<button class="mode-nav-item[^>]*>/g)) {
    assert.match(button, /data-mode-subtitle="[^"]+"/, 'every workspace keeps its description for Help');
  }
});

test('one accent-filled action per view in the key states', () => {
  // Hand: legal actions are peers; Replay transport and New hand are secondary.
  assert.match(logic, /button\.className = 'ui-button ui-button--secondary';\n    button\.dataset\.canonicalAction = type;/);
  assert.match(html, /id="handReplayPlaybackButton" class="ui-button ui-button--secondary/);
  const completion = html.slice(html.indexOf('id="handCompletedReviewButton"') - 200, html.indexOf('id="handCompletedNewHandButton"') + 200);
  assert.equal((completion.match(/ui-button--primary/g) || []).length, 1, 'Review hand is the completion primary');
  assert.match(html, /id="handReviewAnalyze" class="ui-button ui-button--secondary/);
  // Home: only the first continuation leads.
  assert.match(logic, /resume\.className = `ui-button \$\{index === 0 \? 'ui-button--primary' : 'ui-button--secondary'\}`/);
  // Training: Start leads before a session, Next exercise after an answer.
  assert.match(logic, /setTrainingButtonEmphasis\(nextButton, state === 'feedback'\);\n  setTrainingButtonEmphasis\(\$\('#trainingNewHand'\), state === 'idle' \|\| state === 'error'\);/);
  // Home Game: with a session open, Complete session leads.
  assert.match(homeGame, /refs\.createButton\?\.classList\?\.toggle\('ui-button--primary', !state\.current\)/);
  // The tutorial offer never competes with a workspace primary.
  assert.match(tutorialBootstrap, /start\.className = 'ui-button ui-button--secondary';/);
  // Selected segments/tabs stay underline-style (DS), so the header switch adds no fill.
  assert.doesNotMatch(css, /\.workspace-mode-switch[^{]*\{[^}]*background:\s*var\(--accent-primary/);
});

test('sidebar footer is one icon row and nav items carry no self-tooltips (QA-SWEEP-029)', () => {
  const footer = railHtml.slice(railHtml.indexOf('class="rail-utilities"'));
  for (const id of ['langToggle', 'audioToggleBtn', 'openSettings']) assert.match(footer, new RegExp(`id="${id}"`));
  assert.equal((footer.match(/class="rail-utility-label sr-only"/g) || []).length, 3, 'labels stay for assistive technology');
  assert.match(footer, /<label class="rail-utility rail-language" for="langToggle" data-tooltip="Language" data-i18n-tooltip="Language">/);
  assert.match(css, /\.rail-utilities \{\n  display: flex;/);
  assert.match(css, /\.is-sidebar-collapsed \.rail-utilities \{ flex-direction: column;/);
  assert.doesNotMatch(railHtml, /class="mode-nav-item[^>]+\s(?:title|data-tooltip|data-i18n-title)=/);
  assert.match(logic, /if \(collapsed\) item\.dataset\.tooltip = t\(item\.dataset\.i18nAriaLabel \|\| item\.dataset\.modeTitle \|\| ''\);\n    else delete item\.dataset\.tooltip;/);
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

test('Home has no Destinations panel and links Review Mistakes from the Review header', () => {
  const home = html.slice(html.indexOf('id="homeMode"'), html.indexOf('id="homegameMode"'));
  assert.doesNotMatch(home, /home-destinations-rail|home-quick-links|homeQuickStartTitle/);
  assert.match(home, /<header class="home-section-head"><div>[\s\S]*?id="homeReviewTitle"[\s\S]*?<\/div><button id="homeReviewMistakesLink"[^>]*data-home-destination="review_mistakes" hidden>/);
  assert.match(logic, /link\.hidden = !\(model\.sections\.quickStart\?\.destinations \|\| \[\]\)\.includes\('review_mistakes'\)/);
  assert.match(logic, /navigateToProductDestination\('saved'\);\n        savedLibraryController\?\.showMistakesOnly\?\.\(\);/);
  assert.match(read('../app/src/application/saved-library-workspace.mjs'), /showMistakesOnly\(\) \{[\s\S]*?query = createSavedLibraryQuery\(\{ mistakesOnly: true \}\)/);
});

test('header context publishers are safe during synchronous init (no top-level const in TDZ)', () => {
  // logic.js runs init() during script evaluation, so a publisher must not read a
  // top-level const declared later in the file (it aborted init in development).
  const initCall = logic.indexOf("document.addEventListener('DOMContentLoaded', () => setTimeout(init, 10));");
  assert.ok(initCall > 0);
  const publisher = logic.slice(logic.indexOf('function publishTrainingHeaderContext()'), logic.indexOf('function updateTrainingSessionProgress()'));
  for (const name of publisher.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) || []) {
    const declaration = logic.search(new RegExp(`^const ${name}\b`, 'm'));
    assert.ok(declaration < 0 || declaration < initCall, `${name} is declared after init runs`);
  }
  const handFacts = logic.search(/^const handHeaderFacts\b/m);
  assert.ok(handFacts > 0 && handFacts < initCall);
});
