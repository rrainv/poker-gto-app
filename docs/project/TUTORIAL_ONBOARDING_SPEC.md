# Tutorial and onboarding specification

Status: `TUTORIAL-001` foundation and `TUTORIAL-002` current-app coverage complete, `tutorial-definition/v1`.

## Purpose and boundary

Riverline tutorials are concise, contextual coach marks that explain what a workspace does, how to use it, and why the workflow matters. They complement the Guide and never become a poker, Equity, strategy, Training, Replay, or Saved Study authority.

```text
TutorialDefinition v1
        ↓
tutorial-controller/v1
        ↓
semantic anchor registry + coach-mark presentation
        ↓
local tutorial preferences
```

The domain and controller are under `app/src/tutorial/`. `app/src/application/tutorial-bootstrap.mjs` wires them to the browser presentation. Definitions contain translation keys only; localized prose remains in the canonical EN/RU/HE runtime.

## TutorialDefinition v1

A definition has:

- `schemaVersion: tutorial-definition/v1`;
- a stable semantic `id` and positive integer `version`;
- one owning `workspace`;
- localized `titleKey` and `descriptionKey`;
- `firstUsePolicy`: `prompt` or `manual`;
- `restartPolicy`: `always` or `never`;
- an ordered, non-empty array of unique Tutorial steps.

Each `tutorial-step/v1` has:

- stable `id` and semantic `anchor`;
- localized `titleKey` and `bodyKey`;
- placement preference: `auto`, `top`, `right`, `bottom`, `left`, or `center`;
- emphasis: `spotlight`, `outline`, or `none`;
- optional named `precondition`;
- optional named `completionTrigger`;
- optional interaction-required state and localized interaction instruction.

Interaction hooks are named presentation/application events. Definitions do not contain DOM callbacks, CSS selectors, poker logic, translated prose, or auto-click behavior.

## Semantic anchor policy

Tutorial targets use one stable attribute:

```html
data-tutorial-anchor="home-recent"
```

All lookup goes through `tutorial-anchor-registry/v1`; definitions never carry raw query selectors. Anchor names describe product meaning, not current nesting or styling. Moving a panel is safe when its semantic anchor moves with it.

The registry reports `ready`, `hidden`, or `missing`. Hidden or missing steps are skipped in a bounded pass when a run starts or advances. If the currently displayed target disappears, the controller cancels with `stale_target`; no overlay or timer survives.

## Controller lifecycle

The reusable controller owns:

- start and optional resume;
- Next and Back through available ordered steps;
- Skip and Finish;
- manual restart;
- named presentation-event completion;
- target-loss cancellation;
- workspace-change cancellation;
- overlay/modal cancellation through the application bridge.

The controller never changes workspaces or clicks controls for the user. A future interaction-driven step may wait for a safe event via `RiverlineTutorials.notify(eventName)`. An overlay owner should call `RiverlineTutorials.cancelForOverlay()` before opening above an active tutorial.

## Coach mark and placement

The coach surface is created only for an active tutorial. It supplies:

- a token-based spotlight or outline;
- localized title, body, and `Step x of y` status;
- Back, Next, Skip, and Finish actions;
- an adjacent placement search in preferred/top/right/bottom/left order;
- a compact viewport-clamped fallback when no adjacent position fits.

If the target is outside the viewport, it is brought to the center once with smooth scrolling. Reduced motion uses instant scrolling. Two animation frames allow layout to settle before measuring. ResizeObserver, scroll/resize handlers, and animation-frame layout work exist only while the coach mark is active and are disconnected on every exit.

The tutorial does not fight later user scrolling. Scroll updates only remeasure placement.

## Persistence and versioning

Tutorial state is a UI preference under `riverline.tutorialPreferences.v1`, not a SavedStudyObject.

`tutorial-preferences/v1` stores:

- `localOwnerId: local`, ready for a later account preference adapter;
- records by tutorial ID;
- retained records by tutorial version;
- first-use status (`in_progress`, `completed`, or `skipped`);
- last run status and kind;
- last step ID;
- completion/skip/update timestamps.

A completed or skipped version is not offered again. A new integer version has its own record and may be offered without deleting earlier history. Manual restart remains available and does not erase an earlier completion/skip decision if the user exits that replay. Invalid or unavailable Web Storage falls back to a safe in-memory state for the current session.

## First-use and manual restart policy

`prompt` definitions receive a subtle in-workspace offer on the first meaningful visit; Riverline does not auto-open a blocking coach mark. Starting an interrupted first-use run resumes its last valid step. Skip persists and does not nag after reload.

One compact `?` action in the workspace header opens the currently useful tutorial or a contextual chooser. It stays hidden for workspaces without owned content. The production Home tour preserves its v1 completion record and covers Home context, Recent, Review, Personal Strategy, and Quick Start.

## Current tutorial inventory

| Tutorial ID | Workspace/context | First-use | Coverage |
|---|---|---|---|
| `home.first-use` | Home | prompt | persistent hub, Recent, Review, direct Personal Strategy summary, Quick Start |
| `playbook.scenario-basics` | Playbook / Scenario | prompt in Scenario | what-if snapshot, cards, objective context, provider provenance, analysis entry points, Save Spot, restored Saved Spot truth |
| `playbook.hand-mode` | Playbook / Hand | prompt on first Hand visit | canonical setup, table facts, legal progression, Replay growth, Save Hand |
| `playbook.replay` | Hand or Saved Hand when Replay exists | manual | read-only timeline, Previous/Next, Play/Pause, endpoint semantics, live-analysis boundary, Saved Hand viewer |
| `playbook.analysis-views` | current Playbook analysis view | manual | current Decision, exact Hand & Board facts, structural blockers, explicit supplied-range/provenance boundary, 13×13 preflop Matrix, selected-hand mix, Range Category Comparison, and their limits |
| `equity.basics` | Equity | prompt | players, board/dead cards, exact versus Monte Carlo, calculate/cancel, Equity/Win/Tie interpretation |
| `equity.advanced` | Equity | manual | multiway and unknown hands, dead cards, reproducible seed, result method provenance |
| `training.first-spot` | Training | prompt | drill setup, generated canonical spot, legal answer, optional hints, next-exercise workflow |
| `training.feedback` | answered Training state | manual when available | grading authority, source frequencies, shared explanation, next/replay workflow |
| `calibration.setup` | Range Calibration | prompt | direct-observation boundary, Profile and exactly three Modes, objective RFI context, bounded session start |
| `calibration.answers` | active calibration question | manual when available | dominant-action semantics, explicit exact mixes and ties, direct progress, pause/resume/undo |
| `settings.preferences` | open Settings dialog | prompt | language relationship, theme and card presentation, sound and reduced-motion relationship |

Guide intentionally has no dedicated tutorial. It is already the persistent reference surface that contextual tutorials complement. Saved Scenario spots reuse the Scenario definition and never gain invented history; Saved Hands reuse the Replay definition and retain their distinct read-only context.

The chooser lists only definitions useful in the current context. Replay without history, Training feedback before an answer, and calibration answering without an active question are withheld. Only the basic contextual definition receives a first-use offer; advanced definitions remain manually discoverable.

## Accessibility

The coach panel is a labelled, described, non-modal dialog (`aria-modal="false"`). Background content is not falsely marked inaccessible, and the visual spotlight does not intercept pointer input.

- focus enters the coach on start and returns to the invoking control on exit;
- Escape skips and closes;
- Right Arrow/Page Down advances;
- Left Arrow/Page Up goes back;
- buttons retain normal Tab behavior and visible focus;
- an interaction-required step hides Next so the named safe event owns progression;
- step count uses a polite live region;
- the highlighted target remains visible and independently available.

## Localization, RTL, themes, and responsive behavior

All stable copy is present in EN, RU, and HE. The panel inherits document direction, uses logical CSS properties, and keeps target geometry in physical viewport coordinates so RTL does not mirror measurements. Long copy wraps within a bounded, scrollable coach panel.

Coach marks use the current Riverline surface, border, focus, accent, shadow, spacing, radius, and motion tokens. Midnight, Daylight, and Graphite therefore share the normal product visual language.

Desktop placement is bounded to the viewport at the accepted 1024×768 through 2560×1600 sizes. There is no mobile-specific composition in this ticket.

## Performance and isolation

When inactive, the tutorial surface has no observer, animation frame, scroll/resize listener, keyboard listener, or layout measurement. The first-use offer is ordinary static DOM. Tutorial modules do not import or invoke StrategyProvider, DecisionContext, Equity, Matrix, Training, Replay, Saved Study Objects, or the poker domain.

## Checkpoint and future ownership

Tutorial foundation and current-app coverage are complete. Every future meaningful feature, mode, or workspace must add or update its own tutorial definition, semantic anchors, EN/RU/HE copy, and relevant acceptance coverage within the feature ticket. A feature versions only its affected tutorial; it does not reopen a broad tutorial project or invalidate unrelated completion records.

Future feature tickets may add definitions, anchors, preconditions, and safe presentation events. They do not redefine the v1 controller, persistence authority, targeting policy, or coach-mark visual system unless review proves a shared blocker and adds regression coverage. A future Range Builder, richer weighted-range Analysis foundation, or materially changed Replay flow therefore owns its own tutorial update. Video/GIF pipelines, poker lessons, quizzes, gamification, accounts, and cloud sync remain separate scope.
