export const PERSONAL_STRATEGY_STATUS_LABEL_KEYS = Object.freeze({
  directly_known: 'Specified',
  inferred_high: 'Supported',
  inferred_medium: 'Tentative',
  transferred: 'Supported',
  uncertain: 'Tentative',
  conflicting: 'Conflict',
  unknown: 'Unknown',
});

export const PERSONAL_STRATEGY_REASON_LABEL_KEYS = Object.freeze({
  direct_dominant_observation: 'Direct dominant action recorded',
  direct_exact_frequency_observation: 'Direct exact mix recorded',
  direct_tied_exact_mix: 'Direct tied exact mix recorded',
  conflicting_direct_evidence: 'Active direct answers conflict',
  multiple_consistent_neighbors: 'Multiple consistent direct neighbors',
  adjacent_same_family_support: 'Supported by nearby hands in the same family',
  pair_neighbor_support: 'Supported by nearby pairs',
  suited_run_support: 'Supported by nearby suited hands',
  connectivity_shift_support: 'Supported by nearby connected hands',
  suited_offsuit_counterpart_support: 'Supported by the suited or offsuit counterpart',
  bounded_regional_interpolation: 'Supported by an evidence-consistent regional run',
  observed_regional_action_boundary: 'Between observed Raise/Fold boundaries',
  regional_order_discontinuity: 'Direct answers reveal an unusual gap',
  boundary_nearby: 'Near a Raise/Fold boundary',
  conflicting_neighbor: 'Conflicting nearby answers',
  scope_locally_unstable: 'Nearby direct answers are locally unstable',
  insufficient_support: 'Not enough nearby direct evidence',
  no_structurally_relevant_evidence: 'No relevant direct evidence yet',
  unsupported_direct_action: 'The direct action is outside this Fold/Raise model',
  additional_first_in_actions_unmodeled: 'Fold/Raise is modeled here; Limp and All-in remain unmodeled.',
  training_evidence_excluded_from_002b_inference: 'Training evidence is shown separately and does not drive this inference',
  direct_donor_evidence: 'Transferred from direct evidence in a compatible nearby RFI context',
  multiple_agreeing_donor_contexts: 'Multiple compatible donor contexts agree',
  exact_donor_preserved_but_target_transfer_is_qualitative: 'Exact donor mix is preserved at its source; this target transfer stays qualitative',
  cold_start_anchor: 'Samples a new hand family',
  uncertainty_reduction: 'Reduces uncertainty here',
  near_action_boundary: 'Near a Raise/Fold boundary',
  pair_boundary: 'High-value pair boundary',
  transferred_estimate_check: 'Checks a transferred estimate',
  transfer_disagreement: 'Checks a transferred estimate that disagrees locally',
  unknown_pair_region: 'Maps an unknown pocket-pair region',
  offsuit_broadway_boundary: 'Clarifies your offsuit Broadway boundary',
  modeled_region_redundancy_penalty: 'Already modeled by a supported regional run',
  sparse_region: 'Sparse evidence in this region',
  inferred_high_maintenance: 'Review a supported estimate',
  inferred_medium_review: 'Review a tentative estimate',
});

export const PERSONAL_STRATEGY_ACTION_LABEL_KEYS = Object.freeze({
  ask_next: 'Ask next',
  explore_boundary: 'Explore this boundary',
  explore_sparse_region: 'Explore this region',
  inspect_conflict: 'Inspect',
  inspect_transfer: 'Inspect',
  refine_exact_mix: 'Refine exact mix',
});

export function personalStrategyStatusLabelKey(status) {
  return PERSONAL_STRATEGY_STATUS_LABEL_KEYS[status] ?? 'Unknown';
}

export function personalStrategyReasonLabelKey(reason) {
  return PERSONAL_STRATEGY_REASON_LABEL_KEYS[reason] ?? 'Additional supporting evidence';
}

export function personalStrategyActionLabelKey(kind) {
  return PERSONAL_STRATEGY_ACTION_LABEL_KEYS[kind] ?? 'Open';
}

