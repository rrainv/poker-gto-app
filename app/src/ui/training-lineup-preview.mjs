import { deriveSeatAssignments } from '../../../shared/poker-domain/positions.js';
import { createTableCast, opponentPortrait, tableEnvironmentCopy } from './table-environment.mjs';

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
  const el = (tag, text, className) => {
    const node = doc.createElement(tag); if (text !== undefined) node.textContent = text;
    if (className) node.className = className; return node;
  };
  const update = config => {
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
    root.replaceChildren(); root.hidden = !seats.length;
    const header = el('header');
    header.append(el('p', t('Your next table'), 'training-lineup-eyebrow'), el('h3', `${config.playerCount}-max · Hero ${config.heroPosition} · ${config.stack} bb`), el('p', t('Setup preview. No hand is in play.')));
    const roster = el('ul', undefined, 'training-lineup-roster');
    for (const player of seats) {
      const item = el('li'); item.dataset.hero = String(player.isHero);
      if (player.identity) { const portrait = el('img'); portrait.decoding = 'async'; portrait.loading = 'lazy'; portrait.src = opponentPortrait(player.identity); portrait.alt = ''; portrait.width = 64; portrait.height = 64; item.append(portrait); }
      else item.append(el('span', 'H', 'training-lineup-hero'));
      const name = player.isHero ? 'Hero' : tableEnvironmentCopy(player.identity, language).split(' · ')[0];
      const copy = el('div'); copy.append(el('strong', name), el('bdi', player.position)); item.append(copy); roster.append(item);
    }
    const settings = el('div', undefined, 'training-lineup-settings');
    settings.append(el('p', `${t('Assistance')}: ${config.assistance}`));
    if (focus) settings.append(el('p', focus));
    if (behavior) settings.append(el('p', [target, behavior].filter(Boolean).join(' · ')));
    settings.append(el('small', t('Portraits are appearance only. Opponent settings determine behavior.')));
    root.append(header, roster, settings);
  };
  browserWindow.RiverlineTrainingLineup = Object.freeze({ update });
  const refresh = () => browserWindow.updateTrainingSetupSummary?.();
  doc.getElementById('trainingSetupPanel')?.addEventListener('change', refresh);
  browserWindow.addEventListener('riverline:languagechange', refresh);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', refresh, { once: true }); else refresh();
  return browserWindow.RiverlineTrainingLineup;
}
if (typeof window !== 'undefined') installTrainingLineupPreview(window);
