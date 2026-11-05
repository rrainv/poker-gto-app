import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGE_CONFIRMATION_STORAGE_KEY,
  createAgeConfirmation,
  getHelpLinks,
  LEGAL_HELP_LINKS,
} from '../app/src/application/legal-notices.mjs';
import { bootApp } from './helpers/app-under-test.mjs';

// NOTICES-001: the one-time 18+ / study tool confirmation on the first-run
// Welcome overlay. Stored locally once, never shown again, never nagging.
function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
  };
}

test('the confirmation is stored once and then stays confirmed for later sessions', () => {
  const storage = memoryStorage();
  const first = createAgeConfirmation({ storage, clock: () => '2026-11-05T10:00:00.000Z' });
  assert.equal(first.isConfirmed(), false);
  first.confirm();
  first.confirm();
  assert.equal(first.isConfirmed(), true);
  const stored = JSON.parse(storage.getItem(AGE_CONFIRMATION_STORAGE_KEY));
  assert.equal(stored.confirmedAt, '2026-11-05T10:00:00.000Z', 'a second confirm does not rewrite it');
  assert.equal(createAgeConfirmation({ storage }).isConfirmed(), true, 'a new session reads it back');
});

test('broken or foreign stored values count as not confirmed', () => {
  for (const raw of ['nope', '{}', JSON.stringify({ confirmed: true }), JSON.stringify({ schemaVersion: 'age-confirmation/v1', confirmed: true, confirmedAt: 'x' })]) {
    const storage = memoryStorage();
    storage.setItem(AGE_CONFIRMATION_STORAGE_KEY, raw);
    assert.equal(createAgeConfirmation({ storage }).isConfirmed(), false, raw);
  }
  const failing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const blocked = createAgeConfirmation({ storage: failing });
  assert.equal(blocked.isConfirmed(), false);
  assert.doesNotThrow(() => blocked.confirm());
  assert.equal(blocked.isConfirmed(), true, 'kept for this session when storage is blocked');
});

test('help links render nothing until the owner supplies them, and never invent or accept unsafe URLs', () => {
  for (const language of ['en', 'ru', 'he']) assert.deepEqual(getHelpLinks(language), [], language);
  assert.deepEqual(Object.keys(LEGAL_HELP_LINKS).sort(), ['en', 'he', 'ru']);
  const source = {
    en: [
      { name: 'Example Help', href: 'https://help.example.test/' },
      { name: 'Script', href: 'javascript:alert(1)' },
      { name: '', href: 'https://help.example.test/' },
      { name: 'Plain http', href: 'http://help.example.test/' },
    ],
  };
  assert.deepEqual(getHelpLinks('en', source).map((entry) => entry.name), ['Example Help']);
  assert.deepEqual(getHelpLinks('ru', source), []);
});

const app = await bootApp({ oriented: false });
const $ = (selector) => app.$(selector);
const checkbox = () => $('#welcomeAgeConfirm');

test('first run shows one required line on the Welcome overlay, with the exact wording', () => {
  assert.equal(app.document.documentElement.dataset.welcomeOrientation, 'visible');
  assert.equal($('#welcomeAgeRow').hidden, false);
  assert.equal(checkbox().required, true);
  assert.equal($('#welcomeAgeText').textContent,
    "I'm 18 or older, and I understand Riverline is a study tool: it has no real-money play and isn't gambling advice.");
  assert.equal($('#welcomeAgeHint').hidden, true, 'no nagging before the person acts');
});

test('leaving without confirming is blocked with a quiet hint; Escape cannot skip it either', async () => {
  await app.click('[data-welcome-destination="home"]');
  assert.equal($('#welcomeOrientation').hidden, false, 'still on the overlay');
  assert.equal(checkbox().getAttribute('aria-invalid'), 'true');
  assert.equal($('#welcomeAgeHint').hidden, false);
  assert.equal(app.document.activeElement, checkbox(), 'focus goes to the checkbox');
  assert.equal(app.window.localStorage.getItem(AGE_CONFIRMATION_STORAGE_KEY), null);
  assert.equal(app.window.localStorage.getItem('riverline.welcomeOrientation.v1'), null, 'orientation is not marked done either');

  app.dispatch($('#welcomeOrientation'), new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await app.settle(50);
  assert.equal($('#welcomeOrientation').hidden, false);
  assert.equal(app.window.localStorage.getItem(AGE_CONFIRMATION_STORAGE_KEY), null);
});

test('confirming stores it once and lets the person in; the overlay offers it no more', async () => {
  checkbox().checked = true;
  app.dispatch(checkbox(), new app.window.Event('change', { bubbles: true }));
  assert.equal(checkbox().hasAttribute('aria-invalid'), false);
  assert.equal($('#welcomeAgeHint').hidden, true);
  await app.click('[data-welcome-destination="home"]');
  await app.settle(50);
  assert.equal($('#welcomeOrientation').hidden, true);
  const stored = JSON.parse(app.window.localStorage.getItem(AGE_CONFIRMATION_STORAGE_KEY));
  assert.equal(stored.confirmed, true);
  assert.equal(stored.schemaVersion, 'age-confirmation/v1');

  // Reopened from Learn Riverline: the line is not shown again.
  await app.click('#workspaceLearnButton');
  await app.settle(50);
  assert.equal($('#welcomeAgeRow').hidden, true);
  assert.equal($('#welcomeOrientation').hidden, false);
});
