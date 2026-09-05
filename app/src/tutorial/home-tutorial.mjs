import { createTutorialDefinition } from './domain.mjs';

export const HOME_TUTORIAL_ID = 'home.first-use';

export const HOME_TUTORIAL_DEFINITION = createTutorialDefinition({
  id: HOME_TUTORIAL_ID,
  // The expanded Home tour remains the released v1 experience. Only an
  // intentional content migration may bump this and re-offer first use.
  version: 1,
  workspace: 'home',
  titleKey: 'A quick tour of Home',
  descriptionKey: 'See how Home keeps useful study work close without turning it into another task list.',
  firstUsePolicy: 'prompt',
  restartPolicy: 'always',
  steps: [
    {
      id: 'overview',
      anchor: 'home-overview',
      titleKey: 'Your study starts with context',
      bodyKey: 'Saved study, Personal Strategy, and Training Memory stay on this device in Guest Mode. Guest data does not sync.',
      placement: 'bottom',
    },
    {
      id: 'recent',
      anchor: 'home-recent',
      titleKey: 'Return to important decisions',
      bodyKey: 'Saved hands and study spots appear in Recent so you can reopen decisions worth studying without rebuilding them.',
      placement: 'top',
    },
    {
      id: 'review',
      anchor: 'home-review',
      titleKey: 'Build a focused review habit',
      bodyKey: 'Review groups the hands and spots you marked to revisit or as mistakes, turning saved material into a focused study queue.',
      placement: 'left',
    },
    {
      id: 'personal-strategy',
      anchor: 'home-personal-strategy',
      titleKey: 'Keep personal strategy claims grounded',
      bodyKey: 'Personal Strategy summarizes your direct Range Calibration work. Riverline stores those observations, but experimental sparse inference is not presented here as finished confidence or a production range source.',
      placement: 'right',
    },
    {
      id: 'quick-start',
      anchor: 'home-quick-start',
      titleKey: 'Move into the right tool',
      bodyKey: 'Quick Start opens Riverline\'s main workspaces. Use it when you know whether you want to analyze, practise, calculate Equity, or build a personal range.',
      placement: 'top',
    },
  ],
});
