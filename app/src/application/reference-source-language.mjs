export const REFERENCE_COVERAGE_COPY = Object.freeze({
  exact: 'The selected reference covers this exact preflop node.',
  pending: 'This file matches the preflop node, but Riverline has not accepted it as a reference.',
  restricted: 'This file matches the node, but its accepted permissions do not allow reference display here.',
  sizing: 'The selected source does not cover this bet or raise size.',
  stack: 'The selected source does not cover this stack depth.',
  incompatible: 'The selected source uses different assumptions for this spot.',
  generalized: 'The selected source provides generalized coverage, not an exact reference for this spot.',
  partial: 'The selected source is incomplete for this spot.',
  unavailable: 'Riverline has no accepted reference for this spot yet.',
});

export function referenceCoveragePresentation(facts, { translate = (key) => key, locale = 'en' } = {}) {
  const state = facts?.state;
  const key = facts?.available === true && state === 'exact' ? 'exact'
    : state === 'exact' ? facts?.acceptance === 'accepted' ? 'restricted' : 'pending'
      : state === 'incompatible' ? facts.incompatibleDimensions?.includes('stack') ? 'stack'
        : facts.incompatibleDimensions?.includes('sizing') ? 'sizing' : 'incompatible'
        : ['partial', 'generalized'].includes(state) ? state : 'unavailable';
  const messageKey = REFERENCE_COVERAGE_COPY[key];
  return Object.freeze({ key, messageKey, text: translate(messageKey),
    dir: String(locale).split('-')[0] === 'he' ? 'rtl' : 'ltr' });
}
