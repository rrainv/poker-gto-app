import { SYNTHETIC_PRESETS, createSyntheticConfiguration } from './synthetic-opponent-policy.mjs';
import { compareOpponentLearningPolicies, createPersonalOpponentStudy } from './opponent-learning-facts.mjs';
import { opponentLearningCopy as copy, describeOpponentTeaching } from './opponent-learning-language.mjs';
import { describeOpponentPolicy } from './opponent-policy-language.mjs';
import { exploitOpportunityCopy } from './exploit-opportunity-language.mjs';

const presetKey = preset => ({ 'calling-heavy': 'calling', 'tight-passive': 'tight' })[preset] ?? preset;

export function renderOpponentComparison(root, configuration, otherConfiguration, language = 'en', doc = root.ownerDocument) {
  const el = (tag, text) => { const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  const facts = compareOpponentLearningPolicies(configuration, otherConfiguration);
  root.replaceChildren(); root.dir = language === 'he' ? 'rtl' : 'ltr';
  const grid = el('div'); grid.className = 'opponent-learning-comparison';
  for (const [index, config] of [facts.left, facts.right].entries()) {
    const column = el('article'); column.append(el('h5', copy(index === 0 ? 'currentConfiguration' : 'comparisonConfiguration', language)),
      el('p', describeOpponentPolicy(config, language)));
    for (const question of describeOpponentTeaching(config, language)) column.append(el('p', question));
    grid.append(column);
  }
  root.append(grid);
  for (const difference of facts.differences) {
    const line = el('p', `${copy(difference.context, language)}: `);
    const value = el('bdi', `${difference.left}% / ${difference.right}%`); value.dir = 'ltr'; line.append(value); root.append(line);
  }
  if (!facts.differences.length) root.append(el('p', copy('same', language)));
  root.append(el('p', copy('limits', language)));
}

export function mountPersonalOpponentStudy({ root, study, language = 'en', regionLabel, onTeach, signal } = {}) {
  const doc = root.ownerDocument, life = new AbortController();
  const el = (tag, text) => { const node = doc.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  root.dir = language === 'he' ? 'rtl' : 'ltr';
  const details = el('details'); details.append(el('summary', copy('personal', language)), el('p', copy('personalNote', language)));
  const policy = el('select'); policy.dataset.opponentStudy = 'policy';
  for (const preset of Object.keys(SYNTHETIC_PRESETS)) {
    const option = el('option', copy(presetKey(preset), language)); option.value = preset; policy.append(option);
  }
  policy.value = 'calling-heavy';
  const label = el('label', copy('title', language)); label.append(policy); details.append(label);
  const output = el('div'); details.append(output); root.append(details);
  let facts = null, outputLife = new AbortController();
  const render = () => {
    outputLife.abort(); outputLife = new AbortController(); output.replaceChildren();
    const configuration = createSyntheticConfiguration(SYNTHETIC_PRESETS[policy.value]);
    facts = createPersonalOpponentStudy({ study, configuration });
    if (facts.availability !== 'available') { output.append(el('p', copy('unknown', language))); return; }
    output.append(el('p', describeOpponentPolicy(configuration, language)));
    for (const line of describeOpponentTeaching(configuration, language)) output.append(el('p', line));
    for (const region of facts.coverage) {
      output.append(el('p', copy('coverage', language, { region: regionLabel(region.id), mapped: region.mappedCombos,
        unknown: region.unknownPolicyCombos, preferred: region.dominantCombos })));
      const checking = facts.checkingIntent.find(entry => entry.region === region.id);
      const candidate = checking && checking.exactCheckingCombos + checking.preferredCheckingCombos > 0;
      if (candidate) {
        const line = el('p', exploitOpportunityCopy('regionCheck', language));
        const token = el('bdi', ` ${checking.exactCheckingCombos} / ${checking.preferredCheckingCombos} / ${checking.totalKnownReachedCombos}`);
        token.dir = 'ltr'; line.append(token); output.append(line);
        if (facts.exploitIncentives.signals.includes('more_calls_less_fold_pressure')) output.append(el('p', exploitOpportunityCopy('regionQuestion', language)));
      }
      if (onTeach && (region.unknownPolicyCombos || region.dominantCombos || candidate)
        && facts.nextQuestions.some(question => question.region === region.id)) {
        const teach = el('button', `${copy('teach', language)}: ${regionLabel(region.id)}`);
        teach.type = 'button'; teach.className = 'ui-button ui-button--secondary'; teach.dataset.opponentStudy = 'teach';
        teach.addEventListener('click', () => onTeach(region.id), { signal: outputLife.signal }); output.append(teach);
      }
    }
    if (facts.coverage.length && facts.coverage.every(region => !region.unknownPolicyCombos)) output.append(el('p', copy('complete', language)));
    output.append(el('p', copy('limits', language)));
  };
  policy.addEventListener('change', render, { signal: life.signal });
  const dispose = () => { life.abort(); outputLife.abort(); facts = null; root.replaceChildren(); };
  signal?.addEventListener('abort', dispose, { once: true });
  if (signal?.aborted) dispose(); else render();
  return Object.freeze({ dispose, getFacts: () => facts });
}
