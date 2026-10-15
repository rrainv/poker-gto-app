import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { appStyleSheet, bootApp, indexDocument, text } from './helpers/app-under-test.mjs';

// TEST-HYGIENE-001: index.html / styles.css / logic.js assertions are
// behavioural (parsed markup, cascade, running app). Other module sources are
// outside this ticket and keep their original checks.
const [homeSource, homeBootstrap, personalRepository, translations] = await Promise.all([
  readFile(new URL('../app/src/application/home-view-model.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/home-workspace-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/personal-strategy/repository.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8'),
]);

const markup = indexDocument();
const css = appStyleSheet();
const app = await bootApp();
const bootedHome = {
  continueText: text(app.byId('homeContinueContent')),
  playbookResolution: app.window.app.playbookResolution ?? null,
  decisionContext: app.window.app.decisionContext ?? null,
};

test('Home is the real landing workspace with bounded recurring study sections', () => {
  // Protects: Home is the initial active workspace; Continue/Recent/Review
  // sections exist in the main flow; the removed rails stay removed; Review
  // Mistakes lives in the Review header; Personal Strategy actions route there.
  const shell = markup.querySelector('.riverline-shell');
  assert.equal(shell.dataset.activeMode, 'home');
  assert.equal(markup.querySelector('[data-navigation-id="home"]').getAttribute('aria-current'), 'page');
  const homeMode = markup.getElementById('homeMode');
  assert.ok(homeMode.classList.contains('mode-view') && homeMode.classList.contains('active'));
  const flow = markup.querySelector('.home-main-flow');
  for (const id of ['homeContinueTitle', 'homeRecentTitle', 'homeReviewTitle']) {
    assert.ok(flow.contains(markup.getElementById(id)), `${id} is in the Home main flow`);
  }
  // SHELL-001 (owner decision): the Destinations rail duplicated the sidebar and
  // was removed; "Review Mistakes" moved into the Review section header.
  for (const id of ['homeQuickStartTitle', 'homeStrategyTitle', 'homeOtherTitle']) assert.equal(markup.getElementById(id), null, id);
  assert.equal(markup.querySelector('.home-destinations-rail'), null);
  const reviewTitle = markup.getElementById('homeReviewTitle');
  assert.equal(reviewTitle.tagName, 'h2');
  assert.equal(text(reviewTitle), 'Review');
  const mistakes = markup.getElementById('homeReviewMistakesLink');
  assert.equal(mistakes.dataset.homeDestination, 'review_mistakes');
  assert.equal(mistakes.previousElementSibling, reviewTitle.parentElement, 'the link follows the Review heading');

  // Calibration continuations and Personal Strategy summaries route to Personal Strategy.
  app.call('renderHomeContinue', { items: [{ kind: 'range_calibration', title: 'Saturday', answeredCount: 3, totalCount: 9, context: {} }] });
  const resume = app.$('#homeContinueContent button');
  assert.equal(resume.dataset.homeDestination, 'personal-strategy');
  assert.equal(text(resume), 'Resume calibration');
  const strategyRoot = app.document.createElement('div');
  strategyRoot.id = 'homeStrategyContent';
  app.document.body.appendChild(strategyRoot);
  try {
    for (const section of [{ status: 'unavailable' }, { status: 'ok', profileCount: 0 }]) {
      app.call('renderHomePersonalStrategy', section);
      assert.equal(strategyRoot.querySelector('button').dataset.homeDestination, 'personal-strategy');
    }
  } finally {
    strategyRoot.remove();
  }
});

test('Home queries are bounded and contain no compute or full-library authority', () => {
  assert.match(homeSource, /listRecent\(\{ limit: HOME_RECENT_LIMIT \}\)/);
  assert.match(homeSource, /listForReview\(\{ limit: HOME_REVIEW_LIMIT \}\)/);
  assert.match(homeSource, /listMistakes\(\{ limit: HOME_MISTAKE_LIMIT \}\)/);
  assert.doesNotMatch(`${homeSource}\n${homeBootstrap}`, /exportLibrary|loadSnapshot|StrategyProvider|resolveStrategy|Equity|Matrix|Training|setInterval|requestAnimationFrame/);
  assert.match(personalRepository, /loadHomeSummary[\s\S]*?CURRENT_RANGE_OBSERVATIONS[\s\S]*?getAllByIndex[\s\S]*?'scopeKey'/);
  assert.doesNotMatch(homeBootstrap, /indexedDB|objectStore|transaction/);
});

test('Home and saved viewers expose accessible actions, error states, RTL copy, and responsive layout', () => {
  // Protects: saved rows expose a named open action; load failures render an
  // error state; saved viewers explain read-only / unavailable history; the
  // Home flow is a shrinkable grid that never forces horizontal overflow.
  app.call('renderHomeRecent', { status: 'ok', items: [{
    id: 'saved-1', kind: 'spot', title: 'River bluff catch', tags: [], updatedAt: '2026-09-01T00:00:00.000Z',
    annotations: { title: 'River bluff catch', tags: [] },
  }] });
  const open = app.$('#homeRecentContent .home-open-button');
  assert.equal(open.dataset.homeSavedId, 'saved-1');
  assert.match(open.getAttribute('aria-label'), /^Open spot: .+/);
  app.call('renderHomeRecent', { status: 'error' });
  assert.match(text(app.$('#homeRecentContent .home-error-state')), /could not be loaded/);

  assert.match(text(markup.getElementById('savedHandViewerBanner')), /Read-only/);
  assert.match(text(markup.getElementById('savedSpotViewerBanner')), /History unavailable/);

  const grid = markup.querySelector('.home-dashboard-grid');
  for (const width of [1920, 1366, 1100, 800]) {
    assert.equal(css.cascaded(grid, 'display', { width }), 'grid');
    assert.equal(css.cascaded(grid, 'grid-template-columns', { width }), 'minmax(0, 1fr)', `one shrinkable column at ${width}`);
  }
  for (const section of markup.querySelectorAll('.home-main-flow > .home-section')) {
    assert.equal(css.cascaded(section, 'min-width'), '0');
  }
  // Home headings align to the reading start side in both directions.
  const headingCopy = markup.querySelectorAll('#homeMode .home-section-head :is(p, h2)');
  for (const node of headingCopy) assert.notEqual(css.cascaded(node, 'text-align'), 'right', 'LTR start side');
  markup.documentElement.setAttribute('dir', 'rtl');
  try {
    for (const node of headingCopy) assert.notEqual(css.cascaded(node, 'text-align'), 'left', 'RTL start side');
  } finally {
    markup.documentElement.removeAttribute('dir');
  }
  assert.match(translations, /const ru =/);
  assert.match(translations, /const he =/);
  for (const key of ['Saved Hand', 'Saved Spot', 'Read-only', 'Review later', 'Mistake', 'Resume calibration', 'Open replay']) {
    assert.match(translations, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
});

test('Home initialization stays cheap under orientation and Playbook initializes only when opened', async () => {
  // Protects: booting into Home renders Home without resolving the Playbook;
  // returning to Home refreshes it; opening Analyze resolves the Playbook once
  // ('Playbook opened').
  assert.match(bootedHome.continueText, /Start a Hand/);
  assert.equal(bootedHome.playbookResolution, null, 'the Playbook was not resolved at boot');
  assert.equal(bootedHome.decisionContext, null);

  const spy = app.spy(['updateContext', 'refreshHomeWorkspace']);
  try {
    await app.navigate('analyze');
    assert.deepEqual(spy.calls.updateContext.map(([reason]) => reason), ['Playbook opened']);
    assert.equal(spy.count('refreshHomeWorkspace'), 0);
    await app.navigate('home');
    assert.ok(spy.count('refreshHomeWorkspace') >= 1, 'returning Home refreshes it');

    // While the welcome orientation is showing, Home does not load.
    spy.reset();
    const orientationVisible = app.window.welcomeOrientationIsVisible;
    app.window.welcomeOrientationIsVisible = () => true;
    try {
      app.call('scheduleHomeRefresh');
      app.advance(500);
      await app.flush();
      assert.equal(spy.count('refreshHomeWorkspace'), 0);
    } finally {
      app.window.welcomeOrientationIsVisible = orientationVisible;
    }
  } finally {
    spy.restore();
  }
});
