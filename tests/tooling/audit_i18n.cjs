#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const i18nPath = path.join(repoRoot, 'app', 'src', 'locales', 'i18n.js');
const productTranslationsPath = path.join(repoRoot, 'app', 'src', 'locales', 'product-translations.js');
const accountTranslationsPath = path.join(repoRoot, 'app', 'src', 'locales', 'account-translations.js');
const analysisTranslationsPath = path.join(repoRoot, 'app', 'src', 'locales', 'analysis-translations.js');
const rangeCalibrationTranslationsPath = path.join(repoRoot, 'app', 'src', 'locales', 'range-calibration-translations.js');
const homeTranslationsPath = path.join(repoRoot, 'app', 'src', 'locales', 'home-translations.js');
const homeGameTranslationsPath = path.join(repoRoot, 'app', 'src', 'locales', 'home-game-translations.js');
const welcomeTranslationsPath = path.join(repoRoot, 'app', 'src', 'locales', 'welcome-translations.js');
const productSources = [
  path.join(repoRoot, 'app', 'index.html'),
  path.join(repoRoot, 'app', 'src', 'core', 'logic.js'),
  path.join(repoRoot, 'app', 'src', 'application', 'range-calibration-workspace.mjs'),
  path.join(repoRoot, 'app', 'src', 'application', 'account-identity-bootstrap.mjs'),
  path.join(repoRoot, 'app', 'src', 'ui', 'teacher.js'),
  path.join(repoRoot, 'app', 'src', 'ui', 'TableRenderer.js'),
  analysisTranslationsPath,
  accountTranslationsPath
];

function loadTranslations(
  source = fs.readFileSync(i18nPath, 'utf8'),
  { includeProductCatalog = true } = {}
) {
  const storage = new Map();
  const context = {
    window: {},
    document: {
      readyState: 'loading',
      addEventListener() {},
      documentElement: {},
      getElementById() { return null; },
      body: null
    },
    navigator: { language: 'en' },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); }
    }
  };
  if (includeProductCatalog && fs.existsSync(productTranslationsPath)) {
    vm.runInNewContext(fs.readFileSync(productTranslationsPath, 'utf8'), context, { filename: productTranslationsPath });
  }
  if (includeProductCatalog && fs.existsSync(accountTranslationsPath)) {
    vm.runInNewContext(fs.readFileSync(accountTranslationsPath, 'utf8'), context, { filename: accountTranslationsPath });
  }
  if (includeProductCatalog && fs.existsSync(analysisTranslationsPath)) {
    vm.runInNewContext(fs.readFileSync(analysisTranslationsPath, 'utf8'), context, { filename: analysisTranslationsPath });
  }
  if (includeProductCatalog && fs.existsSync(rangeCalibrationTranslationsPath)) {
    vm.runInNewContext(fs.readFileSync(rangeCalibrationTranslationsPath, 'utf8'), context, { filename: rangeCalibrationTranslationsPath });
  }
  if (includeProductCatalog && fs.existsSync(homeTranslationsPath)) {
    vm.runInNewContext(fs.readFileSync(homeTranslationsPath, 'utf8'), context, { filename: homeTranslationsPath });
  }
  if (includeProductCatalog && fs.existsSync(homeGameTranslationsPath)) {
    vm.runInNewContext(fs.readFileSync(homeGameTranslationsPath, 'utf8'), context, { filename: homeGameTranslationsPath });
  }
  if (includeProductCatalog && fs.existsSync(welcomeTranslationsPath)) {
    vm.runInNewContext(fs.readFileSync(welcomeTranslationsPath, 'utf8'), context, { filename: welcomeTranslationsPath });
  }
  vm.runInNewContext(source, context, { filename: i18nPath });
  return context.window.appTranslations;
}

function decodeHtmlAttribute(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function readJsStringLiteral(quote, body) {
  try {
    return vm.runInNewContext(`${quote}${body}${quote}`);
  } catch {
    return body;
  }
}

function collectVisibleTranslationKeys(sources = productSources) {
  const keys = new Set();
  for (const sourcePath of sources) {
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const match of source.matchAll(/data-i18n(?:-placeholder|-aria-label|-aria-description|-title|-label)?="([^"]+)"/g)) {
      keys.add(decodeHtmlAttribute(match[1]));
    }
    for (const match of source.matchAll(/\b(?:t|localizedText|setLocalizedText|analysisMessage|tableMessage)\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
      keys.add(readJsStringLiteral(match[1], match[2]));
    }
    for (const match of source.matchAll(/\bsetText\([^,]+,\s*(['"])((?:\\.|(?!\1).)*)\1/g)) {
      keys.add(readJsStringLiteral(match[1], match[2]));
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b, 'en'));
}

function findCrossLocaleScriptContamination(dictionaries, visibleKeys) {
  const scripts = {
    cyrillic: /[\u0400-\u04FF]{2,}/u,
    hebrew: /[\u0590-\u05FF]{2,}/u
  };
  const forbidden = {
    en: [['cyrillic', scripts.cyrillic], ['hebrew', scripts.hebrew]],
    ru: [['hebrew', scripts.hebrew]],
    he: [['cyrillic', scripts.cyrillic]]
  };
  const findings = [];
  for (const language of ['en', 'ru', 'he']) {
    const dictionary = dictionaries[language] || {};
    for (const key of visibleKeys) {
      const value = String(dictionary[key] || '');
      for (const [script, pattern] of forbidden[language]) {
        if (pattern.test(value)) findings.push({ language, key, value, forbiddenScript: script });
      }
    }
  }
  return findings;
}

function findDuplicateLiteralKeys(source = fs.readFileSync(i18nPath, 'utf8')) {
  const duplicates = [];
  for (const language of ['en', 'ru', 'he']) {
    const marker = new RegExp(`(?:"${language}"|${language})\\s*:\\s*\\{`, 'g');
    const match = marker.exec(source);
    if (!match) continue;
    let depth = 1;
    let index = marker.lastIndex;
    let quote = null;
    let escaped = false;
    let body = '';
    for (; index < source.length && depth > 0; index += 1) {
      const char = source[index];
      if (quote) {
        body += char;
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        body += char;
      } else if (char === '{') {
        depth += 1;
        body += char;
      } else if (char === '}') {
        depth -= 1;
        if (depth > 0) body += char;
      } else {
        body += char;
      }
    }
    const definitions = new Map();
    for (const keyMatch of body.matchAll(/^\s*"((?:\\.|[^"])*)"\s*:\s*"((?:\\.|[^"])*)"/gm)) {
      const key = readJsStringLiteral('"', keyMatch[1]);
      const value = readJsStringLiteral('"', keyMatch[2]);
      if (!definitions.has(key)) definitions.set(key, []);
      definitions.get(key).push(value);
    }
    for (const [key, values] of definitions) {
      if (values.length > 1) {
        duplicates.push({
          language,
          key,
          count: values.length,
          conflicting: new Set(values).size > 1,
          values: [...new Set(values)]
        });
      }
    }
  }
  return duplicates;
}

function findMojibake(sources = [i18nPath, ...productSources]) {
  const suspicious = /\uFFFD|Ã.|Â.|â(?:€|„|€œ|€™|™|œ|ž|€“|€”|†|‡|•|€¦)|Ð.|Ñ./u;
  const findings = [];
  for (const sourcePath of sources) {
    fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/).forEach((line, index) => {
      if (suspicious.test(line)) {
        findings.push({
          file: path.relative(repoRoot, sourcePath).replaceAll('\\', '/'),
          line: index + 1,
          text: line.trim().slice(0, 180)
        });
      }
    });
  }
  return findings;
}

function findHardcodedRendererCandidates(sourcePath = path.join(repoRoot, 'app', 'src', 'core', 'logic.js')) {
  const candidates = [];
  const assignment = /(?:textContent|innerHTML|\.title|\.placeholder)\s*=\s*(['"`])([^\r\n]*?[A-Za-z][^\r\n]*?)\1/;
  fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (!assignment.test(line)) return;
    if (/\bt\(|data-i18n|console\.|dataset\.|className/.test(line)) return;
    candidates.push({
      file: path.relative(repoRoot, sourcePath).replaceAll('\\', '/'),
      line: index + 1,
      text: line.trim().slice(0, 220)
    });
  });
  return candidates;
}

function findHardcodedHtmlCandidates(sourcePath = path.join(repoRoot, 'app', 'index.html')) {
  const candidates = [];
  fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (!/>[^<>]*[A-Za-z][^<>]*</.test(line)) return;
    if (/data-i18n|<style|<script|<svg|<path|<!--|<title/.test(line)) return;
    candidates.push({
      file: path.relative(repoRoot, sourcePath).replaceAll('\\', '/'),
      line: index + 1,
      text: line.trim().slice(0, 220)
    });
  });
  return candidates;
}

function buildAudit({ dictionarySource, includeProductCatalog = true } = {}) {
  const dictionaries = loadTranslations(
    dictionarySource || fs.readFileSync(i18nPath, 'utf8'),
    { includeProductCatalog }
  );
  const visibleKeys = collectVisibleTranslationKeys();
  const coverage = {};
  for (const language of ['en', 'ru', 'he']) {
    const dictionary = dictionaries[language] || {};
    coverage[language] = {
      dictionaryKeys: Object.keys(dictionary).length,
      visibleKeys: visibleKeys.length,
      missing: visibleKeys.filter((key) => !Object.hasOwn(dictionary, key)),
      identicalToEnglish: language === 'en' ? [] : visibleKeys.filter((key) => (
        Object.hasOwn(dictionary, key)
        && dictionary[key] === (dictionaries.en[key] || key)
      ))
    };
  }
  return {
    visibleKeys,
    coverage,
    semantic: {
      russianClear: dictionaries.ru?.Clear,
      russianFold: dictionaries.ru?.Fold,
      russianClearDistinctFromFold: Boolean(
        dictionaries.ru?.Clear
        && dictionaries.ru?.Fold
        && dictionaries.ru.Clear.toLocaleLowerCase('ru') !== dictionaries.ru.Fold.toLocaleLowerCase('ru')
      )
    },
    duplicateLiteralKeys: findDuplicateLiteralKeys(),
    crossLocaleScriptContamination: findCrossLocaleScriptContamination(dictionaries, visibleKeys),
    mojibake: findMojibake(),
    hardcodedHtmlCandidates: findHardcodedHtmlCandidates(),
    hardcodedRendererCandidates: findHardcodedRendererCandidates()
  };
}

function printAudit(audit) {
  console.log(`Visible translation keys: ${audit.visibleKeys.length}`);
  for (const language of ['en', 'ru', 'he']) {
    const result = audit.coverage[language];
    console.log(`${language.toUpperCase()}: ${result.dictionaryKeys} dictionary keys; ${result.missing.length} missing visible keys; ${result.identicalToEnglish.length} visible values identical to English`);
    if (result.missing.length) console.log(`  Missing: ${result.missing.join(' | ')}`);
  }
  console.log(`Russian Clear: ${audit.semantic.russianClear || '<missing>'}`);
  console.log(`Russian Fold: ${audit.semantic.russianFold || '<missing>'}`);
  console.log(`Russian Clear distinct from Fold: ${audit.semantic.russianClearDistinctFromFold}`);
  console.log(`Duplicate literal keys: ${audit.duplicateLiteralKeys.length}`);
  console.log(`Conflicting duplicate literal keys: ${audit.duplicateLiteralKeys.filter((item) => item.conflicting).length}`);
  console.log(`Cross-locale script contamination: ${audit.crossLocaleScriptContamination.length}`);
  console.log(`Mojibake findings: ${audit.mojibake.length}`);
  console.log(`Hardcoded HTML candidates: ${audit.hardcodedHtmlCandidates.length}`);
  for (const finding of audit.hardcodedHtmlCandidates) {
    console.log(`  ${finding.file}:${finding.line} ${finding.text}`);
  }
  console.log(`Hardcoded renderer candidates: ${audit.hardcodedRendererCandidates.length}`);
  for (const finding of audit.hardcodedRendererCandidates) {
    console.log(`  ${finding.file}:${finding.line} ${finding.text}`);
  }
}

if (require.main === module) {
  const audit = buildAudit();
  if (process.argv.includes('--json')) console.log(JSON.stringify(audit, null, 2));
  else printAudit(audit);
}

module.exports = {
  buildAudit,
  collectVisibleTranslationKeys,
  findDuplicateLiteralKeys,
  findCrossLocaleScriptContamination,
  findHardcodedHtmlCandidates,
  findHardcodedRendererCandidates,
  findMojibake,
  loadTranslations
};
