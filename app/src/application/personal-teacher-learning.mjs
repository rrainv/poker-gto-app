export function personalTeacherLearning({ handClass, actionType = null, mix = null, notSure = false, progress = null, nextHand = null }) {
  const family = progress?.coverage?.families?.find(entry => entry.handClasses.includes(handClass));
  const percentages = Array.isArray(mix) ? Object.fromEntries(mix.map(entry => [entry.action.type, Math.round(entry.probability * 10000) / 100])) : mix;
  return Object.freeze({ handClass, actionType: notSure ? null : actionType, mix: notSure || !percentages ? null : structuredClone(percentages),
    precision: notSure ? 'uncertain' : mix ? 'exact' : 'dominant',
    directCount: progress?.directCount ?? null, unknownCount: progress?.visibleUnknownCount ?? null, nextHand,
    family: family ? structuredClone({ labelKey: family.labelKey, directCount: family.directCount, totalClasses: family.totalClasses,
      probeHand: family.probeHand, boundaries: family.boundaries, conflictHands: family.conflictHands }) : null,
    assessment: 'none', appliesTo: 'this_hand_class_in_this_context' });
}
