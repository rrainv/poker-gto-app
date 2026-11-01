// TERMS-HEURISTIC-001 (owner decision 2026-10-31): the word "heuristic" is not user-facing.
// Screens say "Baseline" (RU «Базовая стратегия», HE «אסטרטגיית בסיס»). Explain's Source /
// provenance details (the analysis.* catalog family, the source-authority limitation
// messages and the Explain fact label), docs and code identifiers may keep it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bootApp } from './helpers/app-under-test.mjs';

const app = await bootApp({ width: 1920 });
const translations = app.window.appTranslations;
const WORD = { en: /heuristic/i, ru: /эвристик/i, he: /היוריסט/ };

// Keys whose text is allowed to name the source technique: Explain's provenance details.
const EXPLAIN_SOURCE_DETAILS = (key) => /^analysis\./.test(key)
  || key === 'Heuristic sampled equity'
  || /^Postflop position uses a bounded heuristic adjustment/.test(key)
  || /^(Heads-up opening uses|First-position six-max opening|Limped preflop trees|Facing a 3-bet uses|Facing a 4-bet uses|The postflop fallback does not|Postflop responses use|Postflop raise responses use|Multiway postflop play)/.test(key);

test('no catalog text outside Explain source details says "heuristic" in EN, RU or HE', () => {
  const offenders = [];
  for (const language of ['en', 'ru', 'he']) {
    for (const [key, value] of Object.entries(translations[language])) {
      if (WORD[language].test(String(value)) && !EXPLAIN_SOURCE_DETAILS(key)) offenders.push(`${language}: ${key.slice(0, 70)} => ${String(value).slice(0, 70)}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the shell markup shows no "heuristic" outside lookup keys', () => {
  const html = fs.readFileSync(new URL('../app/index.html', import.meta.url), 'utf8');
  // data-i18n* attribute values are stable lookup keys, not displayed text.
  const visible = html.replace(/data-i18n[a-z-]*="[^"]*"/g, '');
  assert.deepEqual(visible.match(/[^<>\n]{0,40}heuristic[^<>\n]{0,40}/gi) || [], []);
});

test('the Baseline term follows the terminology table in every language', () => {
  const t = (key, language) => translations[language][key];
  for (const key of ['Heuristic baseline', 'Heuristic fallback']) {
    assert.equal(t(key, 'en'), 'Baseline', `${key} (EN)`);
    assert.equal(t(key, 'ru'), 'Базовая стратегия', `${key} (RU)`);
    assert.equal(t(key, 'he'), 'אסטרטגיית בסיס', `${key} (HE)`);
  }
  assert.equal(t('Matches heuristic baseline', 'en'), 'Matches the baseline');
  assert.equal(t('Strategy source: Heuristic fallback', 'en'), 'Strategy source: Baseline');
  assert.equal(t('HEURISTIC', 'en'), 'BASELINE');
});

test('the keys keep resolving: changed text never breaks a lookup in any language', () => {
  for (const key of ['Heuristic baseline', 'Heuristic fallback', 'HEURISTIC', 'Matches heuristic baseline', 'Heuristic comparison',
    'strategy.heuristic.preflopExplanation', 'strategy.heuristic.postflopExplanation']) {
    for (const language of ['en', 'ru', 'he']) assert.ok(Object.prototype.hasOwnProperty.call(translations[language], key), `${language}: ${key}`);
  }
});

test('code-owned Study and Personal Strategy wording uses the Baseline term', () => {
  const source = fs.readFileSync(new URL('../app/src/application/study-language.mjs', import.meta.url), 'utf8');
  assert.match(source, /heuristicBaseline: \['Baseline', 'Базовая стратегия', 'אסטרטגיית בסיס'\]/);
  const facts = fs.readFileSync(new URL('../app/src/personal-strategy/range-language-facts.mjs', import.meta.url), 'utf8');
  assert.match(facts, /en: 'the baseline', ru: 'базовая стратегия', he: 'אסטרטגיית הבסיס'/);
});
