import { deriveSeatAssignments } from '../../../shared/poker-domain/positions.js';
import { createTableCast, opponentPortrait, opponentSubtitle, OPPONENT_IDENTITIES, tableEnvironmentCopy } from './table-environment.mjs';
import { createTrainingLineup } from '../application/training-lineup.mjs';
import { SYNTHETIC_PRESETS, SYNTHETIC_PARAMETER_KEYS } from '../application/synthetic-opponent-policy.mjs';
import { describeOpponentPolicy, opponentCopy } from '../application/opponent-policy-language.mjs';
const policyCopy = (key, language) => opponentCopy(({ 'calling-heavy': 'calling', 'tight-passive': 'tight', smallPriceCallPercent: 'small', largePriceCallPercent: 'large', freeAggressionPercent: 'free', facingRaisePercent: 'raise' })[key] || key, language);

// Setup projection only. Never constructs a Hand, deals cards or invokes strategy.
export function createTrainingLineupPreview({ playerCount, heroPosition }) {
  if (!Number.isInteger(playerCount) || playerCount < 2 || playerCount > 10) return [];
  const assignments = deriveSeatAssignments(Array.from({ length: playerCount }, (_, seat) => ({ seat, playerId: `preview-${seat}` })), 0);
  if (!assignments.some(player => player.position === heroPosition)) return [];
  const seats = assignments.map(player => ({ ...player, isHero: player.position === heroPosition }));
  const cast = createTableCast(); cast.sync(seats, true);
  return seats.map(player => ({ position: player.position, seat: player.seat, isHero: player.isHero, identity: cast.identity(player.seat) }));
}

export function installTrainingLineupPreview(browserWindow) {
  const doc = browserWindow.document, root = doc.getElementById('trainingLineupPreview');
  if (!root) return null;
  let signature = '';
  const lineup = createTrainingLineup();
  let selectedSeat = null;
  let lastConfig = null;
  const el = (tag, text, className) => {
    const node = doc.createElement(tag); if (text !== undefined) node.textContent = text;
    if (className) node.className = className; return node;
  };
  const update = config => {
    lastConfig = config;
    root.hidden = config.mode !== 'full_hand';
    if (root.hidden) return;
    const language = doc.documentElement.lang.split('-')[0] || 'en';
    const focus = doc.getElementById('opponentStudyQuestion')?.textContent?.trim() || '';
    const behavior = doc.getElementById('opponentPolicyDescription')?.textContent?.trim() || '';
    const targetControl = doc.getElementById('trainingOpponentTarget');
    const target = targetControl?.selectedOptions?.[0]?.textContent?.trim() || '';
    const key = JSON.stringify([config, language, focus, behavior, target]);
    if (key === signature) return; signature = key;
    const t = text => browserWindow.t?.(text) || text;
    const seats = createTrainingLineupPreview(config);
    lineup.sync(seats);
    if (!lineup.get(selectedSeat)) selectedSeat = seats.find(player => !player.isHero)?.seat ?? null;
    root.replaceChildren(); root.hidden = !seats.length;
    const header = el('header');
    header.append(el('p', t('Your next table'), 'training-lineup-eyebrow'), el('h3', `${config.playerCount}-max · Hero ${config.heroPosition} · ${config.stack} bb`), el('p', t('Setup preview. No hand is in play.')));
    const roster = el('ul', undefined, 'training-lineup-roster');
    for (const player of seats) {
      if (!player.isHero) player.identity = lineup.get(player.seat)?.character || player.identity;
      const item = el('li'); item.dataset.hero = String(player.isHero);
      const content = player.isHero ? item : el('button');
      if (!player.isHero) { content.type = 'button'; content.className = 'training-lineup-seat'; content.dataset.lineupSeat = String(player.seat); content.setAttribute('aria-pressed', String(player.seat === selectedSeat)); item.append(content); }
      if (player.identity) { const portrait = el('img'); portrait.decoding = 'async'; portrait.loading = 'lazy'; portrait.src = opponentPortrait(player.identity); portrait.alt = ''; portrait.width = 64; portrait.height = 64; content.append(portrait); }
      else content.append(el('span', 'H', 'training-lineup-hero'));
      const name = player.isHero ? 'Hero' : tableEnvironmentCopy(player.identity, language).split(' · ')[0];
      const copy = el('div'); copy.append(el('strong', name), el('bdi', player.position)); content.append(copy); roster.append(item);
      if (!player.isHero) { copy.append(el('small', policyCopy(lineup.get(player.seat).preset, language))); content.addEventListener('click', () => { selectedSeat = player.seat; renderPanel(); }); }
    }
    const panel = el('section', undefined, 'training-lineup-editor');
    function renderPanel() {
      for (const button of roster.querySelectorAll('button')) button.setAttribute('aria-pressed', String(Number(button.dataset.lineupSeat) === selectedSeat));
      panel.replaceChildren();
      const entry = lineup.get(selectedSeat); if (!entry) return;
      const player = seats.find(player => player.seat === selectedSeat);
      const portrait = el('img'); portrait.src = opponentPortrait(entry.character, 'preview'); portrait.width = 64; portrait.height = 64; portrait.alt = tableEnvironmentCopy(entry.character, language);
      panel.append(portrait, el('h4', `${player.position} · ${tableEnvironmentCopy(entry.character, language)}`), el('p', opponentSubtitle(entry.character, language)));
      const field = (label, input) => { const wrapper = el('label'); wrapper.append(el('span', t(label)), input); panel.append(wrapper); };
      const character = el('select'); character.className = 'control-select'; character.dataset.lineupCharacter = '';
      for (const id of OPPONENT_IDENTITIES) { const option = el('option', tableEnvironmentCopy(id, language)); option.value = id; character.append(option); }
      character.value = entry.character; field('Character', character);
      const behaviorSelect = el('select'); behaviorSelect.className = 'control-select'; behaviorSelect.dataset.lineupPolicy = '';
      for (const id of [...Object.keys(SYNTHETIC_PRESETS), 'custom']) { const option = el('option', policyCopy(id, language)); option.value = id; behaviorSelect.append(option); }
      behaviorSelect.value = entry.preset; field('Behavior', behaviorSelect);
      const description = el('p', describeOpponentPolicy(entry.configuration, language)); panel.append(description);
      const refreshSeat = () => {
        const entry = lineup.get(selectedSeat), button = roster.querySelector(`[data-lineup-seat="${selectedSeat}"]`);
        button.querySelector('img').src = opponentPortrait(entry.character);
        button.querySelector('strong').textContent = tableEnvironmentCopy(entry.character, language).split(' · ')[0];
        button.querySelector('small').textContent = policyCopy(entry.preset, language);
        portrait.src = opponentPortrait(entry.character, 'preview'); portrait.alt = tableEnvironmentCopy(entry.character, language);
        panel.querySelector('h4').textContent = `${player.position} · ${tableEnvironmentCopy(entry.character, language)}`;
        panel.querySelector('p').textContent = opponentSubtitle(entry.character, language);
        description.textContent = describeOpponentPolicy(entry.configuration, language);
      };
      character.addEventListener('change', () => { lineup.character(selectedSeat, character.value); refreshSeat(); });
      behaviorSelect.addEventListener('change', () => { if (behaviorSelect.value !== 'custom') lineup.policy(selectedSeat, behaviorSelect.value); else lineup.policy(selectedSeat, 'custom', lineup.get(selectedSeat).configuration.parameters); refreshSeat(); for (const input of advanced.querySelectorAll('input')) input.value = lineup.get(selectedSeat).configuration.parameters[input.dataset.parameter]; });
      const advanced = el('details', undefined, 'study-disclosure'); advanced.append(el('summary', t('Advanced')));
      for (const key of SYNTHETIC_PARAMETER_KEYS) {
        const label = el('label', policyCopy(key, language)), input = el('input'); input.className = 'control-input'; input.type = 'number'; input.min = '0'; input.max = '100'; input.step = '1'; input.value = entry.configuration.parameters[key]; input.dataset.parameter = key;
        input.addEventListener('change', () => { try { lineup.policy(selectedSeat, 'custom', { ...lineup.get(selectedSeat).configuration.parameters, [key]: Number(input.value) }); input.setAttribute('aria-invalid', 'false'); behaviorSelect.value = 'custom'; refreshSeat(); } catch { input.setAttribute('aria-invalid', 'true'); } });
        label.append(input); advanced.append(label);
      }
      const bulk = el('button', t('Apply this policy to all opponents')); bulk.type = 'button'; bulk.className = 'ui-button ui-button--quiet';
      bulk.addEventListener('click', () => { lineup.applyAll(selectedSeat); for (const button of roster.querySelectorAll('button')) button.querySelector('small').textContent = policyCopy(lineup.get(Number(button.dataset.lineupSeat)).preset, language); });
      panel.append(advanced, bulk);
    }
    renderPanel();
    const settings = el('div', undefined, 'training-lineup-settings');
    settings.append(el('p', `${t('Assistance')}: ${config.assistance}`));
    if (focus) settings.append(el('p', focus));
    settings.append(el('small', t('Portraits are appearance only. Opponent settings determine behavior.')));
    root.append(header, roster, panel, settings);
  };
  browserWindow.RiverlineTrainingLineup = Object.freeze({ update, requests: seed => lineup.requests(seed), character: seat => lineup.get(seat)?.character ?? null,
    selectedRequest: seed => lineup.requests(seed).find(entry => entry.seat === selectedSeat)?.request ?? null,
    setCharacter: (seat, character) => { if (OPPONENT_IDENTITIES.includes(character)) { lineup.character(seat, character); signature = ''; } } });
  const refresh = () => browserWindow.updateTrainingSetupSummary?.();
  browserWindow.RiverlineAccountIdentity?.subscribe(() => { lineup.reset(); signature = ''; selectedSeat = null; if (lastConfig) update(lastConfig); });
  doc.getElementById('trainingSetupPanel')?.addEventListener('change', refresh);
  browserWindow.addEventListener('riverline:languagechange', refresh);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', refresh, { once: true }); else refresh();
  return browserWindow.RiverlineTrainingLineup;
}
if (typeof window !== 'undefined') installTrainingLineupPreview(window);
