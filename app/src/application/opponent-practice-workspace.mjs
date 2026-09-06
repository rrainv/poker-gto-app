import { SYNTHETIC_PARAMETER_KEYS as keys, SYNTHETIC_PRESETS as presets, createSyntheticConfiguration,
  createOpponentPracticeRequest, validateOpponentPracticeRequest, SYNTHETIC_POLICY_ID } from './synthetic-opponent-policy.mjs';
import { opponentCopy, describeOpponentPolicy, describeOpponentDecision } from './opponent-policy-language.mjs';
import { POLICY_STUDY_THEMES, createPolicyTrainingIntent } from './policy-conditioned-training.mjs';
import { opponentLearningCopy } from './opponent-learning-language.mjs';
import { createOpponentDecisionReviewFacts } from './opponent-learning-facts.mjs';
import { renderOpponentComparison } from './opponent-learning-workspace.mjs';

// Ephemeral controls only. No storage, identity, grading or strategy owner.
export function createOpponentPracticeWorkspace(win) {
  const doc = win.document;
  let mounted = false;
  let lastReview = null;
  const locale = () => win.appLang ?? 'en';
  const copy = key => opponentLearningCopy(key, locale());
  const byId = id => doc?.getElementById(id);
  const node = (tag, text = '') => { const element = doc.createElement(tag); element.textContent = text; return element; };
  const localized = (tag, key) => { const element = node(tag, copy(key)); element.dataset.opponentCopy = key; return element; };
  const number = id => { const value = byId(id).value; return value.trim() === '' ? NaN : Number(value); };
  const parameters = () => Object.fromEntries(keys.map(key => [key, number(`opponent-${key}`)]));
  const updateDescription = () => {
    byId('trainingOpponentSetup').dir = locale() === 'he' ? 'rtl' : 'ltr';
    try {
      const configuration = createSyntheticConfiguration(parameters());
      const preset = Object.keys(presets).find(name => keys.every(key => presets[name][key] === configuration.parameters[key]));
      byId('opponentPolicyDescription').textContent = preset
        ? copy(({ 'calling-heavy': 'compactCalling', aggressive: 'compactAggressive', 'tight-passive': 'compactTight' })[preset])
        : opponentLearningCopy('compactCustom', locale(), { small: configuration.parameters.smallPriceCallPercent, raise: configuration.parameters.facingRaisePercent });
      byId('opponentPolicyExactDescription').textContent = describeOpponentPolicy(configuration, locale());
      byId('opponentStudyQuestion').textContent = copy(`${byId('trainingOpponentTheme').value}Note`);
      renderOpponentComparison(byId('opponentPolicyComparison'), configuration,
        createSyntheticConfiguration(presets[byId('trainingOpponentCompare').value]), locale(), doc);
    } catch {
      byId('opponentPolicyDescription').textContent = copy('invalid');
      byId('opponentPolicyExactDescription').textContent = '';
      byId('opponentPolicyComparison')?.replaceChildren();
    }
  };
  const mount = () => {
    const root = byId('trainingOpponentSetup');
    if (mounted || !root) return;
    mounted = true;
    const field = (parent, key, element) => {
      const label = node('label'); label.className = 'ui-field'; label.append(localized('span', key), element); parent.append(label);
    };
    const select = (id, options) => {
      const element = node('select'); element.id = id; element.className = 'control-select';
      options.forEach(([value, key]) => { const option = localized('option', key); option.value = value; element.append(option); });
      return element;
    };
    const preset = select('trainingOpponentPreset', [['calling-heavy', 'calling'], ['aggressive', 'aggressive'], ['tight-passive', 'tight'], ['custom', 'custom']]);
    field(root, 'opponentChoice', preset);
    const description = node('p'); description.id = 'opponentPolicyDescription'; description.setAttribute('aria-live', 'polite'); root.append(description);
    const theme = select('trainingOpponentTheme', POLICY_STUDY_THEMES.map(key => [key, key]));
    field(root, 'studyFocus', theme);
    const question = node('p'); question.id = 'opponentStudyQuestion'; question.setAttribute('aria-live', 'polite');
    theme.addEventListener('change', updateDescription);
    field(root, 'applyTo', select('trainingOpponentTarget', [['all_opponents', 'all'], ['BB', 'bb']]));
    root.append(localized('p', 'compactTruth'));
    const advanced = node('details'); advanced.id = 'trainingOpponentAdvanced'; advanced.append(localized('summary', 'advanced'));
    root.append(advanced);
    const input = (id, max, value) => {
      const element = node('input'); element.id = id; element.type = 'number'; element.min = '0'; element.max = String(max);
      element.step = '1'; element.value = String(value); element.dir = 'ltr'; return element;
    };
    field(advanced, 'seed', input('trainingOpponentSeed', 4294967295, 0));
    const details = node('details'); details.append(localized('summary', 'parameters'));
    keys.forEach((key, index) => {
      const element = input(`opponent-${key}`, 100, presets['calling-heavy'][key]);
      field(details, ['small', 'large', 'free', 'raise'][index], element);
      element.addEventListener('input', () => { preset.value = 'custom'; updateDescription(); });
    });
    advanced.append(details);
    const comparison = node('details'); comparison.append(localized('summary', 'compare'));
    const compare = select('trainingOpponentCompare', [['calling-heavy', 'calling'], ['aggressive', 'aggressive'], ['tight-passive', 'tight']]);
    compare.value = 'aggressive'; field(comparison, 'compare', compare);
    const comparisonOutput = node('div'); comparisonOutput.id = 'opponentPolicyComparison'; comparison.append(comparisonOutput); advanced.append(comparison);
    compare.addEventListener('change', updateDescription);
    const explanation = node('details'); explanation.append(localized('summary', 'policyDetails'));
    const exactDescription = node('p'); exactDescription.id = 'opponentPolicyExactDescription';
    explanation.append(exactDescription, localized('p', 'scope'), question, localized('p', 'themeNote'));
    advanced.append(explanation);
    preset.addEventListener('change', () => {
      if (presets[preset.value]) keys.forEach(key => { byId(`opponent-${key}`).value = String(presets[preset.value][key]); });
      updateDescription();
    });
    updateDescription();
  };
  const renderReview = snapshot => {
    lastReview = snapshot;
    const root = byId('trainingOpponentReview');
    if (!root) return;
    root.dir = locale() === 'he' ? 'rtl' : 'ltr';
    root.replaceChildren();
    const assignments = snapshot?.status === 'terminal'
      ? snapshot.opponentAssignments.filter(item => item.policyId === SYNTHETIC_POLICY_ID) : [];
    root.hidden = assignments.length === 0;
    if (root.hidden) return;
    root.append(localized('h4', 'review'), localized('p', 'sessionNote'));
    if (snapshot.policyTrainingIntent) root.append(node('p', copy(snapshot.policyTrainingIntent.theme)),
      node('p', copy(`${snapshot.policyTrainingIntent.theme}Note`)));
    const evidence = node('details'); evidence.append(localized('summary', 'evidence'));
    const seedLine = node('p', `${copy('seed')}: `);
    const seedToken = node('bdi', String(snapshot.opponentPractice?.policySeed ?? 0)); seedToken.dir = 'ltr';
    seedLine.append(seedToken); evidence.append(seedLine);
    const configurations = new Set();
    assignments.forEach(item => {
      const key = JSON.stringify(item.config);
      if (!configurations.has(key)) root.append(node('p', describeOpponentPolicy(item.config, locale())));
      configurations.add(key);
      const token = node('bdi', `${item.policyId}@${item.policyVersion} · ${item.seat} · ${item.baseSeed}`); token.dir = 'ltr';
      const provenance = node('p'); provenance.append(token); evidence.append(provenance);
    });
    root.append(localized('p', 'scope'));
    const details = node('details'); details.append(localized('summary', 'history'));
    const list = node('ol');
    const line = (parent, key, value) => {
      const row = node('p', `${copy(key)}: `), token = node('bdi', String(value)); token.dir = 'ltr'; row.append(token); parent.append(row);
    };
    const actionName = type => copy(type === 'allIn' ? 'all_in' : type === 'raise' ? 'raiseAction' : type);
    snapshot.botDecisionJournal.decisions.filter(item => item.policyId === SYNTHETIC_POLICY_ID)
      .forEach(item => {
        const facts = createOpponentDecisionReviewFacts(item), info = facts.actorInformation;
        const row = node('li'), detail = node('details'); detail.append(node('summary', describeOpponentDecision(item, locale())));
        if (facts.chosenAction.amountToMilliBb !== null) line(detail, 'amount', facts.chosenAction.amountToMilliBb / 1000);
        detail.append(localized('h5', 'influences'));
        for (const influence of facts.influences) line(detail,
          ({ smallPriceCallPercent: 'small', largePriceCallPercent: 'large', freeAggressionPercent: 'free', facingRaisePercent: 'raise' })[influence.parameter], `${influence.value}%`);
        if (!facts.influences.length) detail.append(localized('p', 'noInfluences'));
        const inputs = node('details'); inputs.append(localized('summary', 'observed'));
        line(inputs, 'position', facts.actor.position); line(inputs, 'board', info.board.join(' ') || '—');
        line(inputs, 'cards', info.ownCards?.join(' ') ?? copy('unknown'));
        line(inputs, 'pot', info.potMilliBb / 1000); line(inputs, 'price', info.legalActionSpec.call.commitMilliBb / 1000);
        line(inputs, 'players', info.players.map(player => `${player.seat} · ${player.position} · ${player.currentStackMilliBb / 1000} bb`).join(' / '));
        line(inputs, 'legal', ['fold', 'check', 'call', 'bet', 'raise', 'allIn'].filter(key => info.legalActionSpec[key]?.available)
          .map(key => `${actionName(key)}${info.legalActionSpec[key].minToMilliBb != null ? ` ${info.legalActionSpec[key].minToMilliBb / 1000}–${info.legalActionSpec[key].maxToMilliBb / 1000} bb` : ''}`).join(' / '));
        inputs.append(localized('h5', 'publicHistory'));
        for (const action of info.actionHistory) {
          const player = info.players.find(player => player.playerId === action.playerId);
          const text = `${opponentCopy(action.street, locale())} · ${player?.position ?? action.playerId} · ${actionName(action.type)}${action.amountToMilliBb == null ? '' : ` ${action.amountToMilliBb / 1000} bb`}`;
          const historyRow = node('p'), token = node('bdi', text); token.dir = 'auto'; historyRow.append(token); inputs.append(historyRow);
        }
        const trace = node('details'); trace.append(localized('summary', 'deterministic'));
        line(trace, 'decisionSeed', facts.decisionSeed);
        line(trace, 'seatSeed', facts.baseSeed);
        line(trace, 'sample', `${item.selectionProvenance.sampleValue} / ${item.selectionProvenance.sampleSpace}`);
        line(trace, 'replay', facts.replayReference.replayEventSequence);
        detail.append(inputs, trace); row.append(detail); list.append(row);
      });
    details.append(list); root.append(details, evidence);
  };
  win.addEventListener?.('riverline:languagechange', () => {
    if (mounted) {
      byId('trainingOpponentSetup').querySelectorAll('[data-opponent-copy]').forEach(element => { element.textContent = copy(element.dataset.opponentCopy); });
      updateDescription();
    }
    renderReview(lastReview);
  });
  return Object.freeze({
    prepareRequest(input) {
      const request = validateOpponentPracticeRequest(input); mount();
      if (!byId('trainingOpponentSetup')) return false;
      keys.forEach(key => { byId(`opponent-${key}`).value = String(request.configuration.parameters[key]); });
      byId('trainingOpponentPreset').value = 'custom';
      byId('trainingOpponentSeed').value = String(request.policySeed);
      byId('trainingOpponentTarget').value = request.target;
      byId('trainingOpponentTheme').value = 'play_policy';
      updateDescription(); return true;
    },
    renderSetup(visible) { mount(); if (byId('trainingOpponentSetup')) byId('trainingOpponentSetup').hidden = !visible; },
    readRequest({ tableSize }) {
      mount();
      if (!byId('trainingOpponentSetup')) return null;
      return createOpponentPracticeRequest({ configuration: createSyntheticConfiguration(parameters()),
        policySeed: number('trainingOpponentSeed'), target: byId('trainingOpponentTarget').value, tableSize });
    },
    readTrainingIntent({ tableSize }) {
      mount();
      if (!byId('trainingOpponentSetup')) return null;
      return createPolicyTrainingIntent({ theme: byId('trainingOpponentTheme').value,
        opponentPractice: createOpponentPracticeRequest({ configuration: createSyntheticConfiguration(parameters()),
          policySeed: number('trainingOpponentSeed'), target: byId('trainingOpponentTarget').value, tableSize }) });
    },
    renderReview,
  });
}
