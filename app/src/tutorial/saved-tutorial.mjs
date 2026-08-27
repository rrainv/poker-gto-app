import { createTutorialDefinition } from './domain.mjs';

export const SAVED_TUTORIAL_ID = 'saved.library';

export const SAVED_TUTORIAL_DEFINITION = createTutorialDefinition({
  id: SAVED_TUTORIAL_ID,
  // Saved owns an independent version so Home content changes never re-offer
  // or relabel the Saved guide.
  version: 1,
  workspace: 'saved',
  titleKey: 'Using Saved study',
  descriptionKey: 'Reopen profile-scoped Hands and Spots without mixing Saved with the Home dashboard.',
  firstUsePolicy: 'manual',
  restartPolicy: 'always',
  steps: [
    {
      id: 'scope',
      anchor: 'saved-workspace',
      titleKey: 'Saved has its own study job',
      bodyKey: 'Saved belongs to the signed-in Riverline profile. Signing in selects that profile on this device; it does not enable sync or cloud backup.',
      placement: 'bottom',
    },
    {
      id: 'recent',
      anchor: 'home-recent',
      titleKey: 'Reopen the exact study object',
      bodyKey: 'Open a Saved Hand for canonical Replay or a Saved Spot for its supplied study context. Saved does not invent missing history.',
      placement: 'top',
      precondition: 'saved-library-ready',
    },
    {
      id: 'review',
      anchor: 'home-review',
      titleKey: 'Return to items you marked',
      bodyKey: 'Review and Mistake group the same Saved objects you explicitly classified; they are study intent, not an objective strategy grade.',
      placement: 'left',
      precondition: 'saved-library-ready',
    },
  ],
});
