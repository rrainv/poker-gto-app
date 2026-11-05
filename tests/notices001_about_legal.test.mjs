import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp, indexDocument } from './helpers/app-under-test.mjs';

// NOTICES-001: Settings > About & legal, the Game night line, and that no
// poker-site promotion exists anywhere in the product.
const app = await bootApp();
const $ = (selector) => app.$(selector);
const markup = indexDocument();
const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

async function openAbout() {
  if (!app.window.RiverlineSettings.isOpen()) await app.click('#openSettings');
  await app.click('#settingsTabAbout');
  await app.settle(30);
}

test('About & legal is a real category with the three statements, the tier legend and the notices', async () => {
  await openAbout();
  assert.equal($('#settingsWorkspace').dataset.settingsCategory, 'about');
  const panel = $('#settingsPanelAbout');
  assert.equal(panel.hidden, false);
  const text = panel.textContent.replace(/\s+/g, ' ');
  assert.match(text, /Riverline is a study tool for No-Limit Hold'em, for education only\. It has no real-money play, no gambling and no guarantee of results\./);
  assert.match(text, /Use it away from the table\. Poker sites ban real-time assistance, and Riverline is not built to be used during real-money play\./);
  assert.match(text, /You must be 18 or older\. If gambling is a problem for you, free and confidential help is available\./);
  assert.deepEqual([...panel.querySelectorAll('.settings-about-tiers dt')].map((node) => node.textContent), ['Exact', 'Verified', 'Estimated', 'Unavailable']);
});

test('no help links are rendered until the owner supplies some', async () => {
  const list = $('#settingsHelpLinks');
  assert.equal(list.hidden, true);
  assert.equal(list.children.length, 0);
  assert.equal($('#settingsPanelAbout').querySelectorAll('a[href]').length, 0, 'no links at all in About & legal');
});

test('third-party notices match what actually ships', () => {
  const html = markup.getElementById('settingsPanelAbout').textContent;
  assert.match(html, /Rubik/);
  assert.match(html, /SIL Open Font License 1\.1/);
  assert.ok(fs.existsSync(new URL('../app/src/ui/assets/fonts/rubik/OFL.txt', import.meta.url)), 'the OFL text ships with the font');
  const foley = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory()) walk(new URL(`${entry.name}/`, dir));
    else if (entry.name.endsWith('.ogg')) foley.push(entry.name);
  });
  walk(new URL('../app/assets/audio/foley/', import.meta.url));
  assert.match(html, new RegExp(`${foley.length} recordings from Freesound`), 'the file count in the notice matches the folder');
  assert.match(read('app/assets/audio/foley/PROVENANCE.md'), /Creative Commons CC0 1\.0/);
  assert.match(read('app/package.json'), /"@supabase\/supabase-js"/);
  assert.match(read('app/package.json'), /"electron"/);
});

test('About & legal is searchable and every string has RU and HE', async () => {
  const keys = [...markup.getElementById('settingsPanelAbout').querySelectorAll('[data-i18n]')].map((node) => node.dataset.i18n);
  keys.push(...[...markup.getElementById('settingsTabAbout').querySelectorAll('[data-i18n]')].map((node) => node.dataset.i18n));
  keys.push(markup.getElementById('homeGameNotice').dataset.i18n);
  const sandbox = { window: {} };
  new Function('window', read('app/src/locales/settings-translations.js'))(sandbox.window);
  const { en, ru, he } = sandbox.window.riverlineSettingsTranslations;
  for (const key of new Set(keys)) {
    if (['Exact', 'Estimated', 'Unavailable'].includes(key)) continue;
    assert.ok(en[key] === key && ru[key] && he[key], `translated: ${key}`);
  }
  await openAbout();
  const search = $('#settingsSearch');
  search.value = 'real-time';
  app.dispatch(search, new app.window.Event('input', { bubbles: true }));
  await app.settle(30);
  assert.equal($('#settingsPanelAbout').hidden, false);
  assert.equal($('[data-setting-id="about-fair-play"]').dataset.settingsFiltered, 'false');
  assert.equal($('[data-setting-id="about-study-tool"]').dataset.settingsFiltered, 'true');
  search.value = '';
  app.dispatch(search, new app.window.Event('input', { bubbles: true }));
});

test('supplied help links render as safe external links for the current language only', async () => {
  const container = app.document.getElementById('settingsMode');
  const original = container.querySelector('#settingsHelpLinks');
  const controller = app.window.RiverlineSettingsWorkspace.mount(container, {
    locale: () => 'en',
    helpLinks: (language) => (language === 'en' ? [{ name: 'Example Help', href: 'https://help.example.test/' }] : []),
  });
  try {
    assert.equal(original.hidden, false);
    const anchor = original.querySelector('a');
    assert.equal(anchor.textContent, 'Example Help');
    assert.equal(anchor.getAttribute('href'), 'https://help.example.test/');
    assert.equal(anchor.getAttribute('rel'), 'noopener noreferrer');
  } finally {
    controller.dispose();
  }
});

test('Game night carries one short line and has no rake or fee fields', () => {
  const notice = markup.getElementById('homeGameNotice');
  assert.equal(notice.textContent, 'A social game among friends. Check your local rules.');
  const workspace = markup.getElementById('homeGameWorkspace');
  assert.doesNotMatch(workspace.innerHTML.replace(/<!--[\s\S]*?-->/g, ''), /rake|\bfee\b|commission|house cut/i);
  for (const file of fs.readdirSync(new URL('../app/src/home-game/', import.meta.url))) {
    assert.doesNotMatch(read(`app/src/home-game/${file}`), /\brake\b|\bfee\b|commission/i, file);
  }
});

test('no poker-site links, logos or promo codes exist in the shipped app files', () => {
  // Descriptive names of a hand-history format (PokerStars) and a game style (ClubGG)
  // are accounting/import vocabulary, not promotion. Links, logos and codes are not.
  const sites = /pokerstars|partypoker|888poker|ggpoker|clubgg|ignition|bovada|americas ?cardroom|winamax/i;
  const promo = /promo(tion)? code|bonus code|referral|affiliate|sign[- ]?up bonus/i;
  const offenders = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const next = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walk(next);
      return;
    }
    if (sites.test(entry.name) && entry.name !== 'hand-history-pokerstars.mjs') offenders.push(`file name: ${entry.name}`);
    if (!/\.(html|css|js|mjs|svg)$/.test(entry.name)) return;
    const source = fs.readFileSync(next, 'utf8');
    if (promo.test(source)) offenders.push(`${entry.name}: promo wording`);
    for (const url of source.match(/https?:\/\/[^\s'"`)<>]+/g) ?? []) {
      if (sites.test(url)) offenders.push(`${entry.name}: ${url}`);
    }
    if (/<a\b[^>]*href=[^>]*(pokerstars|clubgg|ggpoker|partypoker)/i.test(source)) offenders.push(`${entry.name}: link`);
  });
  walk(new URL('../app/', import.meta.url));
  assert.deepEqual(offenders, []);
});
