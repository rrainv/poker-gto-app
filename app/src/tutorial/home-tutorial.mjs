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
      bodyKey: 'Open Study Inbox for one next recommendation and an inspectable queue from Training Memory, Saved and selected Personal conflicts. Due and review reasons stay visible. The queue covers a bounded loaded selection and never changes your intended strategy.',
      placement: 'left',
    },
    {
      id: 'quick-start',
      anchor: 'home-quick-start',
      titleKey: 'Move into the right tool',
      bodyKey: 'Choose a destination to play, analyze, train, or return to your saved study.',
      placement: 'top',
    },
  ],
});
