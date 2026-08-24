import { createTutorialDefinition } from './domain.mjs';

function definition(input) {
  return createTutorialDefinition({ version: 1, restartPolicy: 'always', firstUsePolicy: 'manual', ...input });
}

export const SCENARIO_TUTORIAL_DEFINITION = definition({
  id: 'playbook.scenario-basics', workspace: 'gto', firstUsePolicy: 'prompt',
  titleKey: 'Scenario basics',
  descriptionKey: 'Build a quick what-if decision without claiming a reconstructed hand history.',
  steps: [
    { id: 'workflow', anchor: 'playbook-workflow', titleKey: 'Choose the right Playbook workflow', bodyKey: 'Scenario is a fast, lossy study snapshot for exploring what-if decisions. Use Hand Mode instead when legal action history and canonical PokerState matter.', placement: 'bottom' },
    { id: 'cards', anchor: 'scenario-cards', titleKey: 'Set the known cards', bodyKey: 'Choose Hero cards, board cards, and any known dead cards. These inputs describe the study snapshot; they do not reconstruct how the hand reached it.', placement: 'right' },
    { id: 'context', anchor: 'scenario-context', titleKey: 'Describe the objective spot', bodyKey: 'Set table, stack, position, prior action, pot, and facing size to match the decision you want to study. Scenario values are supplied facts, not trusted call history.', placement: 'left' },
    { id: 'recommendation', anchor: 'playbook-recommendation', titleKey: 'Read the recommendation with its source', bodyKey: 'The action mix is Riverline’s current StrategyProvider result. Keep the source and provenance visible: heuristic guidance is useful study input, not solved GTO or proof of an optimum.', placement: 'bottom' },
    { id: 'views', anchor: 'playbook-analysis-navigation', titleKey: 'Place the decision in context', bodyKey: 'Use Decision for the exact spot, Range Matrix for surrounding preflop hand classes, and Range Category Comparison for a coarse descriptive board comparison.', placement: 'top' },
    { id: 'save', anchor: 'scenario-save', titleKey: 'Save the study snapshot', bodyKey: 'Save Spot preserves this Scenario for later review. Reopening it restores the supplied decision facts, but Riverline does not invent canonical history or Replay for a Scenario-derived spot.', placement: 'bottom' },
    { id: 'saved', anchor: 'saved-spot-context', titleKey: 'A reopened Scenario stays a snapshot', bodyKey: 'This banner marks a restored study spot. Its Scenario facts are available again, while canonical action history remains unavailable.', placement: 'bottom', precondition: 'saved-spot-open' },
  ],
});

export const HAND_TUTORIAL_DEFINITION = definition({
  id: 'playbook.hand-mode', workspace: 'gto', firstUsePolicy: 'prompt',
  titleKey: 'Hand Mode essentials',
  descriptionKey: 'Start and progress a legal canonical hand, then save or replay its history.',
  steps: [
    { id: 'workflow', anchor: 'playbook-workflow', titleKey: 'Hand Mode owns legal progression', bodyKey: 'Hand Mode advances canonical PokerState through dealt cards and legal actions. Unlike Scenario, its stacks, contributions, pot, actor, and history come from the real hand state.', placement: 'bottom' },
    { id: 'setup', anchor: 'hand-setup', titleKey: 'Start the canonical hand', bodyKey: 'Choose seats, stacks, button, Hero, and forced contributions, then start. Riverline establishes the initial state before any decision controls become available.', placement: 'right' },
    { id: 'state', anchor: 'hand-live-stage', titleKey: 'Follow trusted table facts', bodyKey: 'Street, current actor, pot, player stacks, and contributions are projections of canonical state. Use them to understand whose legal decision is next.', placement: 'bottom' },
    { id: 'actions', anchor: 'hand-action-controls', titleKey: 'Deal cards and take legal actions', bodyKey: 'Only controls valid for the current phase are shown. Dealing and betting progress the hand street by street; the tutorial never submits a poker action for you.', placement: 'bottom' },
    { id: 'replay', anchor: 'replay-timeline', titleKey: 'Replay grows with the hand', bodyKey: 'The compact timeline records actions and chance events by street. Select any event to seek a read-only Replay frame without mutating live PokerState.', placement: 'top' },
    { id: 'review', anchor: 'hand-review', titleKey: 'Review every Hero decision after the Hand', bodyKey: 'After completion, Hand Review keeps the canonical result and Replay intact while comparing each recorded Hero action with the displayed source. Source limitations remain visible, and review priority is a probability disagreement—not EV loss.', placement: 'top', precondition: 'hand-review-ready' },
    { id: 'save', anchor: 'hand-save', titleKey: 'Preserve canonical history', bodyKey: 'Save Hand stores the durable canonical snapshot and replay source when available. The saved viewer can be opened later without replacing a separate live hand.', placement: 'bottom', precondition: 'hand-save-ready' },
  ],
});

export const REPLAY_TUTORIAL_DEFINITION = definition({
  id: 'playbook.replay', workspace: 'gto',
  titleKey: 'Using Replay',
  descriptionKey: 'Inspect canonical actions and chance events without changing the live hand.',
  steps: [
    { id: 'saved-viewer', anchor: 'saved-hand-context', titleKey: 'This saved hand is read-only', bodyKey: 'The viewer reconstructs durable canonical hand history. Any separate live Hand Mode session is preserved and can be returned to independently.', placement: 'bottom', precondition: 'saved-hand-open' },
    { id: 'timeline', anchor: 'replay-timeline', titleKey: 'Read the canonical timeline', bodyKey: 'The compact timeline records actions and chance events by street. Select any event to seek a read-only Replay frame without mutating live PokerState.', placement: 'left' },
    { id: 'controls', anchor: 'replay-controls', titleKey: 'Move through history', bodyKey: 'Previous and Next step deterministically through available frames. Play and Pause advance the same read-only cursor at a restrained pace.', placement: 'top' },
    { id: 'endpoint', anchor: 'replay-return', titleKey: 'Return to the correct endpoint', bodyKey: 'Return to live restores the current live decision; in a saved viewer it returns to the saved endpoint. Neither path rewrites canonical history.', placement: 'top' },
    { id: 'analysis', anchor: 'playbook-recommendation', titleKey: 'Analysis remains tied to the live decision', bodyKey: 'While an earlier Replay frame is displayed, current Strategy and Analysis remain tied to the live or saved decision endpoint. Do not read them as recommendations for every historical frame.', placement: 'bottom' },
  ],
});

export const PLAYBOOK_ANALYSIS_TUTORIAL_DEFINITION = definition({
  id: 'playbook.analysis-views', workspace: 'gto',
  titleKey: 'Understanding Playbook analysis',
  descriptionKey: 'Read pressure math, exact-hand, draw, blocker, range, strategy, and source facts without overstating what Riverline knows.',
  steps: [
    { id: 'navigation', anchor: 'playbook-analysis-navigation', titleKey: 'Choose the question you are asking', bodyKey: 'Decision explains one selected spot. Range Matrix remains provider-backed preflop context, while Range Category Comparison remains a separate coarse heuristic sample view.', placement: 'top' },
    { id: 'exact-hand', anchor: 'playbook-analysis-explanation', titleKey: 'Separate hand facts from strategy', bodyKey: 'Open “What goes into this decision?” to see the exact made hand, pair relationship, overlapping flop or turn draws, their structural completion cards, and board structure. Shared completion cards are shown once in the unique total. These facts come from the known cards and canonical evaluator, not from the recommendation.', placement: 'bottom' },
    { id: 'blockers', anchor: 'playbook-analysis-explanation', titleKey: 'Read bluff pressure and blockers structurally', bodyKey: 'Bluff & Pressure derives break-even folds from Hero’s trusted incremental risk and the pot available before the action, while semibluff structure stays separate from the recommendation. 33% required folds does not mean Villain folds 33%; Riverline has no opponent fold-frequency model. Hero-card blockers remain neutral removal facts unless an explicit strategic range partition is supplied.', placement: 'bottom' },
    { id: 'range', anchor: 'playbook-analysis-explanation', titleKey: 'Ranges appear only when supplied', bodyKey: 'Without an explicit canonical weighted range, the Range section stays unavailable instead of estimating one from heuristic samples or Matrix hands. Partial ranges keep unknown combos unknown and show coverage without whole-range percentages. Exact cards, board, range, StrategyResult, and Equity sources remain separate.', placement: 'bottom' },
    { id: 'matrix', anchor: 'range-matrix', titleKey: 'See the surrounding preflop range', bodyKey: 'The 13×13 Matrix organizes pairs, suited hands, and offsuit hands. Cell tint shows the dominant action and its band shows the full provider mix; cells are not claimed as independently solver-resolved.', placement: 'top' },
    { id: 'matrix-selection', anchor: 'range-matrix-selection', titleKey: 'Inspect one hand class', bodyKey: 'Select a cell to read its exact action frequencies in the inspector. Full postflop range expansion is unavailable when the current source cannot provide it.', placement: 'left' },
    { id: 'comparison', anchor: 'range-category-comparison', titleKey: 'Compare coarse hand categories', bodyKey: 'This view compares fixed heuristic preflop samples by made-hand and draw category on the supplied board. It supplements the spot; it is not weighted range-versus-range analysis.', placement: 'top' },
  ],
});

export const EQUITY_BASIC_TUTORIAL_DEFINITION = definition({
  id: 'equity.basics', workspace: 'equity', firstUsePolicy: 'prompt',
  titleKey: 'Equity calculator basics',
  descriptionKey: 'Supply known and unknown cards, calculate, and interpret outcome share.',
  steps: [
    { id: 'players', anchor: 'equity-player-hands', titleKey: 'Describe the players', bodyKey: 'Add opponents and mark each hand known or unknown. Known hands need two cards; unknown hands are sampled or enumerated from the remaining deck.', placement: 'right' },
    { id: 'shared-cards', anchor: 'equity-shared-cards', titleKey: 'Set board and dead cards', bodyKey: 'Enter zero to five board cards in deal order and exclude any known dead or burnt cards. Incomplete boards leave future runouts to the calculation.', placement: 'right' },
    { id: 'method', anchor: 'equity-method', titleKey: 'Choose a truthful calculation method', bodyKey: 'Auto uses exact enumeration when practical and Monte Carlo otherwise. Exact visits every supported realization; Monte Carlo is a seeded estimate whose sample count controls precision.', placement: 'right' },
    { id: 'calculate', anchor: 'equity-calculate', titleKey: 'Calculate or cancel safely', bodyKey: 'Readiness explains missing inputs. Start when the scenario is valid; progress reflects real work, and Cancel stops the run without clearing your cards.', placement: 'top' },
    { id: 'results', anchor: 'equity-results', titleKey: 'Interpret Equity, Win, and Tie', bodyKey: 'Equity is outcome share under the supplied known and assumed cards, including split pots. It is useful evidence, but it is not by itself a complete strategy recommendation.', placement: 'left' },
  ],
});

export const EQUITY_ADVANCED_TUTORIAL_DEFINITION = definition({
  id: 'equity.advanced', workspace: 'equity',
  titleKey: 'Advanced Equity controls',
  descriptionKey: 'Use multiway, dead-card, method, progress, and reproducibility controls.',
  steps: [
    { id: 'multiway', anchor: 'equity-player-hands', titleKey: 'Model multiway uncertainty', bodyKey: 'Use two to ten players and mix known with unknown hands. More players and missing cards increase the realization space and may make simulation the practical method.', placement: 'right' },
    { id: 'dead', anchor: 'equity-shared-cards', titleKey: 'Exclude information you actually know', bodyKey: 'Dead or burnt cards are removed from every remaining hand and runout. Add them only when they are genuinely known.', placement: 'right' },
    { id: 'advanced', anchor: 'equity-advanced', titleKey: 'Reuse a Monte Carlo seed when needed', bodyKey: 'Advanced settings let you keep or reroll a seed. Reusing the same seed makes a simulated calculation reproducible; it does not make the estimate exact.', placement: 'top' },
    { id: 'details', anchor: 'equity-results', titleKey: 'Check method provenance in the result', bodyKey: 'The result identifies the actual method, workload, samples, seed, and ties. Use those facts when comparing exact and simulated outcomes.', placement: 'left' },
  ],
});

export const TRAINING_BASIC_TUTORIAL_DEFINITION = definition({
  id: 'training.first-spot', workspace: 'training', firstUsePolicy: 'prompt',
  titleKey: 'Your first Training spot',
  descriptionKey: 'Generate a legal decision, answer before feedback, and continue the drill.',
  steps: [
    { id: 'setup', anchor: 'training-setup', titleKey: 'Choose a session style', bodyKey: 'Varied Session chooses useful legal variety across streets, positions, tables, stacks, and facing sizes. Focused Drill keeps the exact controls when you want one decision family.', placement: 'left' },
    { id: 'decision', anchor: 'training-decision', titleKey: 'Read the spot before answering', bodyKey: 'Hero cards, board, pot, stack, position, and facing action come from the generated canonical trajectory. Form your answer before Riverline reveals its reference.', placement: 'right' },
    { id: 'actions', anchor: 'training-decision', titleKey: 'Choose one legal action', bodyKey: 'Only legal actions are offered. Your answer is compared once with Riverline’s current StrategyResult according to the Training contract.', placement: 'bottom' },
    { id: 'hints', anchor: 'training-decision', titleKey: 'Use hints as coaching prompts', bodyKey: 'Optional hints reveal one prompt at a time without exposing the full reference strategy before your answer.', placement: 'bottom' },
    { id: 'next', anchor: 'training-next', titleKey: 'Continue the workflow', bodyKey: 'After review, generate the next exercise or adjust the drill. Session progress summarizes this browser run; it is not a future mistake-history or spaced-review system.', placement: 'top' },
  ],
});

export const TRAINING_FEEDBACK_TUTORIAL_DEFINITION = definition({
  id: 'training.feedback', workspace: 'training',
  titleKey: 'Understanding Training feedback',
  descriptionKey: 'Read the verdict, reference frequencies, explanation, and next action after answering.',
  steps: [
    { id: 'feedback', anchor: 'training-feedback', titleKey: 'Interpret the grade narrowly', bodyKey: '“Correct” means your answer matched Riverline’s current reference under the Training grading contract. It is not a claim of mathematically proven universal optimality.', placement: 'bottom', precondition: 'training-answered' },
    { id: 'reference', anchor: 'training-reference', titleKey: 'Compare with the displayed source', bodyKey: 'Reference frequencies come from the named strategy source. They show its mix and do not imply EV loss, solver accuracy, or confidence percentages.', placement: 'left', precondition: 'training-answered' },
    { id: 'analysis', anchor: 'training-analysis', titleKey: 'Use the explanation to review the spot', bodyKey: 'The shared Analysis organizes trusted hand facts and reasons behind the current result. Treat it as study guidance from the current authority, with the same provenance limits.', placement: 'top', precondition: 'training-answered' },
    { id: 'next', anchor: 'training-next', titleKey: 'Apply the review, then move on', bodyKey: 'Generate the next spot once you understand the mismatch or agreement. Replay can revisit this generated trajectory without turning the session into saved mistake history.', placement: 'top' },
  ],
});

export const CALIBRATION_SETUP_TUTORIAL_DEFINITION = definition({
  id: 'calibration.setup', workspace: 'calibration', firstUsePolicy: 'prompt',
  titleKey: 'Range Calibration setup',
  descriptionKey: 'Define the real environment, choose a question goal, and let current evidence guide the session.',
  steps: [
    { id: 'overview', anchor: 'calibration-overview', titleKey: 'Riverline chooses informative hands', bodyKey: 'Riverline selects high-value hands from current direct evidence and the derived uncertainty model. You do not need to answer all 169; direct answers remain yours.', placement: 'bottom' },
    { id: 'empty-profile', anchor: 'calibration-empty-profile', titleKey: 'Name a real poker environment', bodyKey: 'A Profile represents a recognizable game or player-pool identity. Each Profile has exactly three discrete Modes named in your own words; they are not points on a numeric style slider.', placement: 'bottom', precondition: 'calibration-empty' },
    { id: 'profile', anchor: 'calibration-profile', titleKey: 'Name a real poker environment', bodyKey: 'A Profile represents a recognizable game or player-pool identity. Each Profile has exactly three discrete Modes named in your own words; they are not points on a numeric style slider.', placement: 'bottom', precondition: 'calibration-configured' },
    { id: 'context', anchor: 'calibration-context', titleKey: 'Choose objective RFI facts', bodyKey: 'Set environment, table size, Hero position, effective stack, and accounting for an unopened preflop range. These facts identify the direct range you are calibrating.', placement: 'right', precondition: 'calibration-configured' },
    { id: 'start', anchor: 'calibration-start', titleKey: 'Choose a session depth', bodyKey: 'Quick, Standard, and Deep are question-count goals. Pause anytime; Riverline recomputes the next question from saved evidence when you resume.', placement: 'left', precondition: 'calibration-configured' },
    { id: 'teacher', anchor: 'range-teacher-tab', titleKey: 'Learn from your own strategy', bodyKey: 'Range Teacher explains boundaries, conflicts, unknown regions, and qualitative transfers from compatible nearby RFI contexts in your own Personal Strategy evidence. Transfers remain derived, and its suggestions never grade you against GTO or a reference strategy.', placement: 'bottom', precondition: 'calibration-configured' },
    { id: 'builder', anchor: 'calibration-personal-matrix', titleKey: 'Build the same strategy directly', bodyKey: 'Range Builder selects or paints many Matrix hands at once. Builder edits become direct evidence, exact mixes stay explicit, Undo preserves history, and Calibration immediately uses the updated model.', placement: 'top', precondition: 'calibration-configured' },
  ],
});

export const CALIBRATION_ANSWERS_TUTORIAL_DEFINITION = definition({
  id: 'calibration.answers', workspace: 'calibration',
  titleKey: 'Answering and exact mixes',
  descriptionKey: 'Answer adaptive questions, add exact frequencies when useful, and keep direct evidence distinct from inference.',
  steps: [
    { id: 'meaning', anchor: 'calibration-question', titleKey: 'Answer for the named Profile and Mode', bodyKey: 'The displayed hand belongs to the selected real environment, Mode, and RFI context. Choose what best represents that identity, not a generic poker answer.', placement: 'bottom', precondition: 'calibration-question-ready' },
    { id: 'quick', anchor: 'calibration-answer-actions', titleKey: 'Quick answers mean dominant action', bodyKey: 'Fold or Raise records the preferred or dominant action for this hand. It never means the action is played at a pure 100% frequency.', placement: 'bottom', precondition: 'calibration-question-ready' },
    { id: 'mix', anchor: 'calibration-exact-mix', titleKey: 'Use exact mixes only when you know them', bodyKey: 'Set Frequencies stores an explicit Fold/Raise mix separately from a quick answer. An exact tie is valid and has no dominant action.', placement: 'top', precondition: 'calibration-question-ready' },
    { id: 'reason', anchor: 'calibration-question-reason', titleKey: 'See why each hand matters', bodyKey: 'The reason points to a boundary, sparse region, nearby disagreement, or coverage gain. It explains question value, not poker confidence.', placement: 'bottom', precondition: 'calibration-question-ready' },
    { id: 'progress', anchor: 'calibration-progress', titleKey: 'Read progress by category', bodyKey: 'Direct, inferred-high, inferred-medium, uncertain, conflicting, and unknown stay separate. These counts are coverage facts, not a confidence percentage.', placement: 'top', precondition: 'calibration-question-ready' },
    { id: 'inspect-correct', anchor: 'calibration-matrix-inspector', titleKey: 'Inspect and correct Riverline', bodyKey: 'Select a Matrix cell to see direct history, contributing neighbors, and boundary facts. Confirming an inference records only a dominant action; exact mixes remain explicit.', placement: 'left', precondition: 'calibration-question-ready' },
    { id: 'control', anchor: 'calibration-session-controls', titleKey: 'Pause, stop, skip, or undo safely', bodyKey: 'Pause preserves the session, Stop ends it, and Skip or I’m not sure records no poker evidence. Undo retracts the immediately previous direct observation when available.', placement: 'bottom', precondition: 'calibration-question-ready' },
  ],
});

export const SETTINGS_TUTORIAL_DEFINITION = definition({
  id: 'settings.preferences', workspace: 'settings', firstUsePolicy: 'prompt',
  titleKey: 'Settings essentials',
  descriptionKey: 'Adjust language, theme, cards, and sound without touring every toggle.',
  steps: [
    { id: 'overview', anchor: 'settings-overview', titleKey: 'Preferences change presentation', bodyKey: 'Settings controls presentation rather than poker state. Language is available from the global rail; this dialog groups theme, card, and sound preferences.', placement: 'bottom' },
    { id: 'appearance', anchor: 'settings-appearance', titleKey: 'Choose theme and card presentation', bodyKey: 'Choose an immutable built-in theme or a named custom theme. Riverline preserves exact accent, surface, and table colors while deriving readable dependent colors; density, layout, card IDs, and poker calculations stay independent.', placement: 'right' },
    { id: 'account', anchor: 'settings-account', titleKey: 'Saved Study sync is always opt-in', bodyKey: 'Sign-in does not upload study data. In Account / Profile, choose Saved Hands and Spots and Personal Strategy / Range Calibration separately; each remains local-first.', placement: 'left' },
    { id: 'audio', anchor: 'settings-audio', titleKey: 'Keep sound under your control', bodyKey: 'Sound is optional: set the master level, then enable Table / Poker and Study / UI cues separately. Motion is controlled independently and respects the system reduced-motion preference.', placement: 'left' },
  ],
});

export const HOME_GAME_TUTORIAL_DEFINITION = definition({
  id: 'home-game.organizer', workspace: 'homegame', firstUsePolicy: 'prompt',
  titleKey: 'Running a Home Game',
  descriptionKey: 'Track real cash-game money truthfully and finish with a clear settlement.',
  steps: [
    { id: 'overview', anchor: 'home-game-overview', titleKey: 'Home Game is separate from poker analysis', bodyKey: 'This workspace organizes a real poker night. Its players, money ledger, chip snapshots, and settlement do not change PokerState or Riverline strategy.', placement: 'bottom' },
    { id: 'create', anchor: 'home-game-new-session', titleKey: 'Start with the real roster and currency', bodyKey: 'Enter players in seat order and an optional initial buy-in. Guest sessions stay in memory; sign in before starting a game you need to keep.', placement: 'right' },
    { id: 'groups', anchor: 'home-game-groups', titleKey: 'Reuse a group without copying players', bodyKey: 'Signed-in accounts can save an ordered roster and start another independent session from it. Group membership only references saved players.', placement: 'right' },
    { id: 'session', anchor: 'home-game-session', titleKey: 'Let the ledger explain every result', bodyKey: 'Record rebuys, add-ons, cash-outs, and optional chip counts. Money and chips stay separate; completion and settlement remain blocked until the exact money balance is zero.', placement: 'left' },
  ],
});

export const CURRENT_APP_TUTORIAL_DEFINITIONS = Object.freeze([
  SCENARIO_TUTORIAL_DEFINITION,
  HAND_TUTORIAL_DEFINITION,
  REPLAY_TUTORIAL_DEFINITION,
  PLAYBOOK_ANALYSIS_TUTORIAL_DEFINITION,
  EQUITY_BASIC_TUTORIAL_DEFINITION,
  EQUITY_ADVANCED_TUTORIAL_DEFINITION,
  TRAINING_BASIC_TUTORIAL_DEFINITION,
  TRAINING_FEEDBACK_TUTORIAL_DEFINITION,
  CALIBRATION_SETUP_TUTORIAL_DEFINITION,
  CALIBRATION_ANSWERS_TUTORIAL_DEFINITION,
  HOME_GAME_TUTORIAL_DEFINITION,
  SETTINGS_TUTORIAL_DEFINITION,
]);
