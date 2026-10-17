import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import { advancedEquityCopy } from '../app/src/application/advanced-equity-language.mjs';
import { exploitOpportunityCopy } from '../app/src/application/exploit-opportunity-language.mjs';
import { exploitCopy } from '../app/src/application/exploit-teacher-language.mjs';
import { OPPONENT_LEARNING_COPY } from '../app/src/application/opponent-learning-language.mjs';
import { OPPONENT_POLICY_COPY } from '../app/src/application/opponent-policy-language.mjs';
import { continuationCopy } from '../app/src/application/personal-hand-continuation-language.mjs';
import { personalHandCopy } from '../app/src/application/personal-strategy-hand-workspace.mjs';
import { STUDY_COPY, studyCopy } from '../app/src/application/study-language.mjs';
import { previewPersonalStrategyIntent, renderIntentInterpretation } from '../app/src/personal-strategy/intent-interpretation.mjs';

function loadCatalogWindow() {
  const window = {
    localStorage: { getItem: () => 'en', setItem: () => {} },
    document: {
      documentElement: { lang: 'en', dir: 'ltr', setAttribute() {} },
      querySelectorAll: () => [],
      getElementById: () => null,
    },
    addEventListener: () => {},
    dispatchEvent: () => true,
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
  };
  window.window = window;
  window.globalThis = window;
  const context = vm.createContext(window);
  const files = [
    'app/src/locales/product-translations.js',
    'app/src/locales/account-translations.js',
    'app/src/locales/analysis-translations.js',
    'app/src/locales/range-calibration-translations.js',
    'app/src/locales/home-translations.js',
    'app/src/locales/home-game-translations.js',
    'app/src/locales/tutorial-translations.js',
    'app/src/locales/guide-translations.js',
    'app/src/locales/welcome-translations.js',
    'app/src/locales/i18n.js',
  ];
  for (const file of files) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return vm.runInContext('({ appTranslations, trainingWorkspaceTranslations })', context);
}

test('I18N-RESIDUE-001: application and personal-strategy modules use canonical RU/HE poker terminology', () => {
  // Advanced Equity Language
  assert.equal(advancedEquityCopy('hero', 'ru'), 'Hero');
  assert.equal(advancedEquityCopy('hero', 'he'), 'הירו');
  assert.match(advancedEquityCopy('editRange', 'he'), /ריינג'/);
  assert.doesNotMatch(advancedEquityCopy('editRange', 'he'), /טווח/);
  assert.match(advancedEquityCopy('facingHypothesis', 'ru'), /валью/);
  assert.match(advancedEquityCopy('facingHypothesis', 'he'), /ואליו/);

  // Exploit Opportunity & Teacher Language
  assert.match(exploitOpportunityCopy('more_calls_less_fold_pressure', 'ru'), /тонкое валью/);
  assert.match(exploitOpportunityCopy('more_calls_less_fold_pressure', 'ru'), /пасов/);
  assert.match(exploitOpportunityCopy('more_folds_fewer_value_calls', 'he'), /ריינג'/);
  assert.match(exploitOpportunityCopy('more_folds_fewer_value_calls', 'he'), /ואליו דק/);
  assert.equal(exploitOpportunityCopy('value', 'ru'), 'Область валью');
  assert.equal(exploitOpportunityCopy('value', 'he'), 'אזור ואליו');
  assert.match(exploitCopy('threshold', 'ru'), /паса/);
  assert.match(exploitCopy('unchanged', 'ru'), /пасов/);
  assert.match(exploitCopy('catcherUnavailable', 'he'), /ריינג'י ואליו/);
  // Showdown value in HE remains ordinary value ("ערך בהצגה"), not poker value bet
  const exploitTeacherRaw = fs.readFileSync('app/src/application/exploit-teacher-language.mjs', 'utf8');
  assert.match(exploitTeacherRaw, /ערך בהצגה/);
  assert.doesNotMatch(exploitTeacherRaw, /фолд/i);
  assert.doesNotMatch(exploitTeacherRaw, /טווח/);

  // Opponent Learning & Policy Language
  assert.equal(OPPONENT_POLICY_COPY.ru.fold, 'пас');
  assert.match(OPPONENT_LEARNING_COPY.ru.compactTight, /Больше пасов/);
  assert.equal(OPPONENT_LEARNING_COPY.ru.thin_value_questions, 'Изучить тонкое валью');
  assert.match(OPPONENT_LEARNING_COPY.ru.thin_value_questionsNote, /диапазон колла/);
  assert.equal(OPPONENT_LEARNING_COPY.he.thin_value_questions, 'לחקור ואליו דק');
  assert.match(OPPONENT_LEARNING_COPY.he.thin_value_questionsNote, /ריינג' השוואה/);

  // Personal Hand Continuation & Workspace
  assert.equal(continuationCopy('range', 'he'), "הריינג' הנוכחי");
  assert.match(continuationCopy('terminal', 'he'), /להירו/);
  assert.match(continuationCopy('value_boundary', 'ru'), /валью/);
  assert.match(continuationCopy('value_boundary', 'he'), /ל־ואליו/);
  assert.equal(personalHandCopy('fold', 'ru'), 'Пас');
  assert.match(personalHandCopy('remainder', 'ru'), /пас/);
  assert.match(personalHandCopy('assumption', 'he'), /הריינג'/);

  // Study Language
  assert.equal(STUDY_COPY.fold[1], 'Пас');
  assert.equal(studyCopy('open', 'he'), 'פתח מקור');
  assert.match(studyCopy('exploit', 'he'), /הריינג'ים/);
  assert.match(studyCopy('policyLimit', 'he'), /והירו/);
});

test('I18N-RESIDUE-001: intent-interpretation keeps legacy RU input alias while displaying canonical HE range term', () => {
  const legacyRuPreview = previewPersonalStrategyIntent({
    text: 'Я думаю, что тут перефолд на 3-бет',
    language: 'ru',
    scope: { approachId: 'app-1' },
  });
  assert.ok(legacyRuPreview.unresolvedTerms.includes('self_assessment_not_validated'));

  const canonicalRuPreview = previewPersonalStrategyIntent({
    text: 'Я думаю, что тут перепас на 3-бет',
    language: 'ru',
    scope: { approachId: 'app-1' },
  });
  assert.ok(canonicalRuPreview.unresolvedTerms.includes('self_assessment_not_validated'));

  const heRendered = renderIntentInterpretation(
    previewPersonalStrategyIntent({
      text: 'אני פותח זוגות',
      language: 'he',
      scope: { approachId: 'app-1' },
    }),
    'he'
  );
  assert.match(heRendered.uncertainty, /ריינג'/);
  assert.doesNotMatch(heRendered.uncertainty, /טווח/);
});

test('I18N-RESIDUE-001: locale catalogs enforce RU Hero, HE ואליו, HE masculine imperative Open buttons, and preserve numeric טווח', () => {
  const { appTranslations, trainingWorkspaceTranslations } = loadCatalogWindow();

  assert.equal(appTranslations.ru['Hero'], 'Hero');
  assert.equal(appTranslations.ru['FOLD'], 'ПАС');
  assert.equal(appTranslations.he['Value'], 'ואליו');
  assert.equal(trainingWorkspaceTranslations.he['Hero to act'], 'תור הירו');

  // HE Open buttons use masculine imperative "פתח ..."
  assert.equal(appTranslations.he['Open Hand'], 'פתח יד');
  assert.equal(appTranslations.he['Open Analyze'], 'פתח ניתוח');
  assert.equal(appTranslations.he['Open Training'], 'פתח אימון');
  assert.equal(appTranslations.he['Open Equity'], 'פתח אקוויטי');
  assert.equal(appTranslations.he['Open Personal Strategy'], 'פתח אסטרטגיה אישית');
  assert.equal(appTranslations.he['Open Saved'], 'פתח שמורים');
  assert.equal(appTranslations.he['Open Guide'], 'פתח את המדריך');
  assert.equal(appTranslations.he['Open the Guide'], 'פתח את המדריך');
  assert.equal(appTranslations.he['Open settings'], 'פתח הגדרות');
  assert.equal(appTranslations.he['Open Account / Profile'], 'פתח חשבון / פרופיל');
  assert.equal(appTranslations.he['Open Matrix'], 'פתח מטריצה');
  assert.equal(appTranslations.he['Open Builder'], 'פתח את הבונה');
  assert.equal(appTranslations.he['Open replay'], 'פתח הילוך חוזר');
  assert.equal(appTranslations.he['Open spot'], 'פתח ספוט');

  // Ordinary numeric/configuration range keeps "טווח"
  assert.match(appTranslations.he['Hand tables support 2 to 10 players. Enter a whole number in that range.'], /בטווח/);
});
