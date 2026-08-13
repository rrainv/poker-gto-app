import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const { loadTranslations } = require('./tooling/audit_i18n.cjs');
const html = fs.readFileSync(path.join(repoRoot, 'app/index.html'), 'utf8');

test('Russian and Hebrew use one resolved action terminology contract', () => {
  const translations = loadTranslations();
  const contract = [
    ['Fold', 'Фолд', 'פולד'],
    ['Check', 'Чек', "צ'ק"],
    ['Call', 'Колл', 'קול'],
    ['Bet', 'Бет', 'בט'],
    ['Raise', 'Рейз', 'רייז'],
    ['All-in', 'Олл-ин', 'אול-אין'],
    ['3-Bet', '3-бет', '3-בט'],
    ['4-Bet', '4-бет', '4-בט']
  ];

  for (const [key, russian, hebrew] of contract) {
    assert.equal(translations.ru[key], russian, `Russian ${key}`);
    assert.equal(translations.he[key], hebrew, `Hebrew ${key}`);
  }
  assert.equal(translations.he['analysis.fact.callAmount'], 'סכום הקול');
  assert.equal(translations.he['{value} bb to call'], 'קול של {value} bb');
  assert.equal(translations.ru['{value} bb to call'], 'Колл {value} bb');
  assert.equal(translations.ru.OPEN, 'ОПЕН-РЕЙЗ');
  assert.equal(translations.he.CHECK, "צ'ק");
});

test('dynamic Training, Equity, and Guide copy has localized derived labels', () => {
  const translations = loadTranslations();
  assert.equal(translations.ru['to {range}'], 'до {range}');
  assert.equal(translations.he['to {range}'], 'ל־{range}');
  assert.equal(translations.ru['exact enumeration'], 'точный перебор');
  assert.equal(translations.he['exact enumeration'], 'ספירה מדויקת');
  assert.equal(translations.ru['Decision ready'], 'Решение готово');
  assert.equal(translations.he['Another hint'], 'רמז נוסף');
  assert.doesNotMatch(translations.ru['Product guidance, poker terms, and control reference.'], /Product|poker|control/i);
  assert.doesNotMatch(translations.he['Product guidance, poker terms, and control reference.'], /Product|poker|control/i);
});

test('hands, draws, board textures, and analytical terms follow the house contract', () => {
  const translations = loadTranslations();
  const contract = [
    ['Range', 'Рендж', "ריינג'"],
    ['Equity', 'Эквити', 'אקוויטי'],
    ['Pot Odds', 'Шансы банка', 'סיכויי קופה'],
    ['Board', 'Борд', 'בורד'],
    ['Top Pair', 'Топ-пара', 'טופ פייר'],
    ['Two Pair', 'Две пары', 'שני זוגות'],
    ['Flush draw', 'Флеш-дро', 'פלאש דרו'],
    ['Gutshot', 'Гатшот', 'גאטשוט'],
    ['Two-tone', 'Двухмастный', 'דו-צבעי'],
    ['Monotone', 'Одномастный', 'חד-צבעי'],
    ['Paired', 'Спаренный', 'פיירד'],
    ['Connected', 'Связанный', 'קונקטד']
  ];

  for (const [key, russian, hebrew] of contract) {
    assert.equal(translations.ru[key], russian, `Russian ${key}`);
    assert.equal(translations.he[key], hebrew, `Hebrew ${key}`);
  }
});

test('user-approved RU and HE range and workspace names are consistent', () => {
  const translations = loadTranslations();
  const rangeKeys = [
    'Range', 'Range Matrix', 'Range Category Comparison', 'Preflop range',
    'Range advantage', 'Range expansion unavailable', 'against an assumed opponent range',
    'analysis.fact.heuristicRangeFraction', 'analysis.value.assumedRange'
  ];

  for (const key of rangeKeys) {
    assert.match(translations.ru[key], /рендж/iu, `Russian ${key}`);
    assert.doesNotMatch(translations.ru[key], /диапазон/iu, `Russian ${key}`);
    assert.match(translations.he[key], /ריינג'/u, `Hebrew ${key}`);
    assert.doesNotMatch(translations.he[key], /טווח/u, `Hebrew ${key}`);
  }
  assert.equal(translations.ru.Playbook, 'Разбор');
  assert.equal(translations.he.Playbook, 'ניתוח');
  for (const key of ['Getting started and Playbook', 'Playbook workflow', 'Playbook context and configuration']) {
    assert.doesNotMatch(translations.ru[key], /Playbook|Плейбук/iu, `Russian ${key}`);
    assert.doesNotMatch(translations.he[key], /Playbook|פלייבוק/u, `Hebrew ${key}`);
  }
});

test('user-approved Hebrew pot, street, hand, and board terms are exact', () => {
  const translations = loadTranslations();
  assert.equal(translations.he.Pot, 'קופה');
  assert.equal(translations.he['Pot Odds'], 'סיכויי קופה');
  assert.equal(translations.he.Preflop, 'פרה-פלופ');
  assert.equal(translations.he['Top Pair'], 'טופ פייר');
  assert.equal(translations.he['Two-tone'], 'דו-צבעי');
  assert.equal(translations.he.Monotone, 'חד-צבעי');
  for (const key of ['Your pot odds are roughly', 'Easy Mode (Pot Odds & MDF)', 'Show Pot Odds, MDF, or strategic hints before guessing.']) {
    assert.doesNotMatch(translations.he[key], /פוט(?:\s+אודס)?/u, `Hebrew ${key}`);
  }
  assert.match(translations.he['Board Texture:'], /בורד/);
  assert.match(translations.he['Preflop range'], /ריינג' פרה-פלופ/u);
  assert.match(translations.he['Raise / Bet %'], /רייז \/ בט/);
});

test('theme display names localize natural descriptors without changing canonical keys', () => {
  const translations = loadTranslations();
  assert.equal(translations.ru['Riverline Midnight'], 'Riverline: Полночь');
  assert.equal(translations.he['Solver Purple'], 'סגול סולבר');
  assert.equal(translations.ru['Action Red'], 'Красный экшен');
  assert.equal(translations.he['Action Red'], 'אדום אקשן');
  assert.equal(translations.ru['Carbon Slate'], 'Carbon Slate');
  assert.equal(translations.he['Carbon Slate'], 'Carbon Slate');
});

test('range comparison matrix accessibility labels use the localized catalog', () => {
  const translations = loadTranslations();
  assert.match(html, /id="heroRangeGrid"[^>]*data-i18n-aria-label="13 by 13 starting hand matrix"/);
  assert.match(html, /id="villainRangeGrid"[^>]*data-i18n-aria-label="13 by 13 starting hand matrix"/);
  assert.match(translations.ru['13 by 13 starting hand matrix'], /рендж|стартов/iu);
  assert.match(translations.he['13 by 13 starting hand matrix'], /ריינג'/u);
});

test('L10N-001 research and style authorities remain reviewable', () => {
  const researchPath = path.join(repoRoot, 'docs/project/L10N_001_TERMINOLOGY_RESEARCH.md');
  const guidePath = path.join(repoRoot, 'docs/project/LOCALIZATION_STYLE_GUIDE.md');
  const research = fs.readFileSync(researchPath, 'utf8');
  const guide = fs.readFileSync(guidePath, 'utf8');
  const termRows = research.split(/\r?\n/).filter((line) =>
    /^\| (?:Action|Strategy|Street|Core|Role|Hand|Draw|Texture) \|/.test(line)
  );

  assert.ok(termRows.length >= 40 && termRows.length <= 60, `${termRows.length} researched terms`);
  for (const sourceFamily of ['GipsyTeam', 'Poker.ru', 'Poker Place', 'PokerTown', 'Ynet']) {
    assert.match(research, new RegExp(sourceFamily));
  }
  for (const invariant of ['Riverline', 'Hero', 'AKs', 'bb', 'SPR', 'MDF', 'EV']) {
    assert.match(guide, new RegExp(`\\b${invariant}\\b`));
  }
  assert.match(guide, /Action contract/);
  assert.match(guide, /Hebrew punctuation and direction/);
  assert.match(guide, /Do not call heuristic output solved GTO/);
  assert.match(guide, /User-approved house style/);
  assert.match(research, /L10N-001R product-decision annotations/);
});
