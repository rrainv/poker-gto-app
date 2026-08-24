import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, logic, homeSource, homeBootstrap, personalRepository, translations] = await Promise.all([
  readFile(new URL('../app/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/core/logic.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/home-view-model.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/application/home-workspace-bootstrap.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/personal-strategy/repository.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../app/src/locales/home-translations.js', import.meta.url), 'utf8'),
]);

test('Home is the real landing workspace with the five bounded information sections', () => {
  assert.match(html, /data-active-mode="home"/);
  assert.match(html, /data-navigation-id="home"[^>]*aria-current="page"/);
  assert.match(html, /id="homeMode" class="mode-view active"/);
  for (const id of ['homeContinueTitle', 'homeRecentTitle', 'homeReviewTitle', 'homeStrategyTitle', 'homeQuickStartTitle']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-home-destination="hand"/);
  assert.match(html, /data-home-destination="analyze"/);
  assert.match(html, /data-home-destination="training"/);
  assert.match(html, /data-home-destination="equity"/);
  assert.match(html, /data-home-destination="personal-strategy"/);
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
  assert.match(logic, /open\.setAttribute\('aria-label'/);
  assert.match(logic, /home-error-state/);
  assert.match(html, /id="savedHandViewerBanner"[\s\S]*?Read-only/);
  assert.match(html, /id="savedSpotViewerBanner"[\s\S]*?History unavailable/);
  assert.match(css, /grid-template-areas:[\s\S]*?"continue review"[\s\S]*?"recent recent"/);
  assert.match(css, /@media \(max-width: 1120px\)/);
  assert.match(css, /min-width: 0/);
  assert.match(css, /margin-inline|text-align: start/);
  assert.match(translations, /const ru =/);
  assert.match(translations, /const he =/);
  for (const key of ['Saved Hand', 'Saved Spot', 'Read-only', 'Review later', 'Mistake', 'Resume calibration', 'Open replay']) {
    assert.match(translations, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
});

test('Home initialization stays cheap, Welcome does no hidden workspace work, and Playbook initializes only when opened', () => {
  assert.match(logic, /if \(activeWorkspaceMode\(\) === 'home'\) void refreshHomeWorkspace\(\);[\s\S]*?else if \(activeWorkspaceMode\(\) !== 'welcome'\) updateContext\('Ready'\)/);
  assert.match(logic, /if \(mode === 'home'\) \{[\s\S]*?refreshHomeWorkspace\(\)/);
  assert.match(logic, /else if \(!app\.playbookResolution && !activeSavedSpotContext\)[\s\S]*?updateContext\('Playbook opened'\)/);
});
