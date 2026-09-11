# Riverline verification tooling

## Current Beta browser entry point

From the repository root:

```powershell
node tests/tooling/verify_beta_candidate_browser.mjs
```

Prerequisites: Node 24+, installed Firefox (tested version and runtime are printed
by the command), and the pinned automation dependency. Install it once with
`cd tests/tooling` then `npm ci` (`npm.cmd ci` if PowerShell blocks npm.ps1).
The equivalent package command in that directory is `npm run test:browser-beta`.
The app's local Supabase SDK must also exist: run `npm ci --ignore-scripts` in
`app` if its dependencies are not installed. No account credentials are needed.
`puppeteer-core` does not download a browser. Set `FIREFOX_PATH` for a nonstandard
Firefox executable; standard Windows, macOS and Linux paths are supported.
`RIVERLINE_PUPPETEER_MODULE` optionally selects an existing compatible installation,
as in earlier verifiers.

The command owns the existing `tools/dev-web-server.mjs` implementation in-process
on `http://127.0.0.1:3000/`. An occupied port fails clearly without adopting or
stopping someone else's server. Set `RIVERLINE_BROWSER_PORT=0` to have the OS assign
an isolated free port instead. Browser close, startup/flow failure and SIGINT/
SIGTERM close the owned server. There is no detached server process.

Firefox uses a new temporary profile and browser context on every run. Local
storage and IndexedDB belong to a fresh Device Guest; no account is signed in,
no normal browser storage is cleared and no remote data is written. Test names
start with `Beta smoke`. Closing Firefox removes the profile, including test
evidence, Saved items and presets. Reload checks preserve that isolated context
within the run.

Coverage follows the ticket's flow numbers (execution order groups related state):

- Welcome/Home top and inert-click scroll; persisted Midnight/Daylight startup,
  theme-choice focus and Settings Escape dismissal.
- Two/ten-seat draft, live Hand, legal action, imported Review over a retained
  live Hand, completed Review, both Analyze return paths and Replay/i18n labels.
- Four real random Analyze spots, unavailable/ready replacement and Explain
  disclosure keyboard/scroll operation.
- Training answer embargo, reveal focus and next Tab; per-seat opponent lineup;
  Full Hand Hero fold summary and same-Hand Watch rest continuity.
- Personal teaching, sparse 169-cell map, reload, correction lineage and Approach
  isolation; Saved Hand reload/reopen; table preset reload and draft isolation.
- Deterministic Equity calculation, exact improvement/standing wording, focused
  Runout context, stale invalidation and recalculation; Home and Guide structure.

Primary viewport is 1920×1080 at scale 1. The bounded 1366×768 pass includes Home,
ten-seat draft/live Hand, Review, Personal map and Equity, plus Russian/Hebrew RTL
and Daylight smoke. The suite checks broad fit, Hand rail separation, primary
control hit-testing, map-cell fit and a few rendered text contrast probes. These
are bounded checks, not a complete contrast audit or exact pixel baseline. It
creates no passing-step screenshots. Each group has a 45-second timeout.

Failures exit nonzero and print the group plus a temporary
`riverline-browser-beta-*` directory. Each failed run writes at most one viewport
PNG and one JSON report: assertion expected/actual when available, URL/workspace,
viewport, theme/language, focus, bounded visible text, console/page/asset errors
and completed groups. These files are outside Git; delete old failure directories
when no longer useful. Success prints group timings, browser version and warnings.
Uncaught exceptions, unhandled rejections, console errors and failed critical
assets fail the suite; console warnings are retained separately, never discarded.

The suite drives native controls and reads canonical state for stronger identity
assertions. Bounded setup exceptions are explicit in the runner: reset the unused
ten-player Hand and populate a deterministic postflop Explain case through
existing owners. Equity inputs use the real transactional card pickers.
It never creates a replacement poker,
strategy or persistence authority. The imported Review fixture uses the real
import dialog. Theme checks sample the first 12 accessible visible animation
frames; this is earliest DOM/computed-state evidence, not compositor-level proof
that no sub-frame flash exists.

**Automated browser smoke does NOT replace human Firefox visual acceptance.**
It does not establish subjective legibility/polish, complete translation or
accessibility coverage, browser parity, authenticated sync/owner switching,
mathematical exhaustiveness, performance budgets or Beta readiness. Existing QA
and Return Queue owners remain authoritative. Run the full Node gate separately.
CI stays Node-only for v1: provisioning Firefox and app SDK assets is separate
from the current dependency-free CI job; local pre-checkpoint smoke is the gate.

`browser-runtime.mjs` centralizes Firefox launch, settled rendering, server
ownership and failure capture using the patterns in the recent Firefox repair/
modernization verifiers; the Sweep A verifier now shares the Firefox launcher.
Targeted historical verifiers remain available for their
specific audits; the Beta command is the current high-level entry point.

## Strategy calibration

This directory contains deterministic, non-production diagnostics for Riverline's
current `StrategyProvider v1` authority. Nothing under `tests/tooling` is imported
by the browser or Electron runtime.

## External reference benchmark

`REFERENCE-BENCH-001` adds a source-agnostic local runner for manual, public,
Riverline-owned, licensed, or independent-solver observations:

```powershell
node tests/tooling/run-reference-bench.mjs `
  --input C:\private\riverline\capture.json `
  --output C:\private\riverline\report.json `
  --pretty
```

Start from `reference-bench-capture-template.json`, but copy it outside the
repository before entering proprietary observations. The CLI accepts any local
input path; no `.gitignore` change is required. The template contains placeholders,
not external product values. Schema, match gate, metrics, legal boundary, and the
first 42-observation capture design are documented in
`docs/project/REFERENCE_BENCHMARK_SPEC.md` and
`docs/project/REFERENCE_BENCHMARK_FIRST_CAPTURE_PLAN.md`.

Run the summary report from the repository root:

```powershell
node tests/tooling/run-strategy-calibration.mjs --pretty
```

Add `--full` to include action summaries for every one of the 169 preflop hand
classes in every representative configuration. Runtime is intentionally a
separate, non-deterministic report:

```powershell
node tests/tooling/run-strategy-calibration.mjs --runtime --runs=3 --pretty
```

The importable harness supports:

- one exact `DecisionContext v1` through `evaluateDecisionContext`;
- caller-selected 169 classes, positions, stack values, table sizes, facing
  categories, and exact call amounts through `evaluatePreflopGrid`;
- standard 169-class range summaries through `summarizePreflopConfiguration`;
- named flop/turn/river corpora and price, style, multiway, and sizing sweeps;
- permanent position, shallow/medium/deep effective-SPR, legality, action-history,
  price-causality, and HU-versus-multiway counterfactuals;
- eleven DecisionContext v1.1 fact fixtures covering live/effective stacks,
  legacy `potBb` versus exact `currentPotBb`, position relation, legal
  aggressive-to bounds, prior-action summaries, and Scenario-versus-Hand
  provenance;
- defined L1, maximum-action-error, dominant-action, aggression, passive, and
  fold comparisons against a bounded-HU reference.

STRATEGY-REPAIR-001B's frozen pre-edit vectors and current deltas are available
without a reference pack:

```powershell
node tests/tooling/strategy-repair001b-baseline.mjs --pretty
```

`measure-strategy-repair001b-training-impact.mjs` accepts
`--baseline-root=<untouched extracted HEAD>` and compares the old and current
heuristics on identical canonical Training contexts. The report covers every
existing Training decision target and explicitly records that no separate
non-BB limped/isolation Training target exists.

## Product performance profile

PERF-001's non-production Node profile covers application/context resolution,
preflop and postflop provider resolution, 169-cell preflop Matrix preparation,
and deterministic Training generation:

```powershell
node tests/tooling/run-product-performance-profile.mjs --pretty
```

Use `--quick` for a smaller local sample. The report deliberately excludes DOM,
layout, paint, and browser interaction timing; those require a browser harness
and must not be inferred from Node measurements.

## Training practice sampler

TRAINING-SAMPLER-002A's planner-only benchmark measures deterministic structural
selection without generating PokerState, calling StrategyProvider, or touching
the DOM:

```powershell
node tests/tooling/benchmark-training-sampler.mjs --count 1000
node tests/tooling/benchmark-training-sampler.mjs --count 10000
node tests/tooling/benchmark-training-sampler.mjs --count 100000
```

Add `--verify-determinism` to repeat the selected count and compare sequence
digests. The 100,000-selection run is a manual development gate, not normal CI.

## Bounded-HU reference boundary

The current repository does not contain a solved or sufficiently converged
Hold'em strategy fixture. The default report therefore returns
`status: "unavailable"` and no mismatch metrics.

A future fixture can be supplied with:

```powershell
node tests/tooling/run-strategy-calibration.mjs --reference=path/to/reference.json --pretty
```

It must use `riverline-hu-preflop-calibration-reference/v1`, identify
`riverline-hu-preflop-100bb/v1`, and explicitly set
`quality.sufficientForCalibration` to `true`. Each row supplies an exact
`DecisionContext`, a normalized structural reference action vector, and either
the `structural` or `strategic_families` projection. The latter collapses explicit
solver sizes into fold/passive/aggression. DecisionContext v1.1 legal
aggressive-to bounds are consumed only to project possible action families;
they remain context facts, not strategy sizing recommendations. The bounded
reference comparison still does not treat those bounds as solver sizes.

The limp branch remains excluded from bounded-HU reference comparison even
though the heuristic now consumes DecisionContext v1.1 limp summaries: the
repository has no trusted limp-branch reference output, and the context does
not retain the branch's prior-action 4bb size anchor. Reference quality metadata
is a gate, not an informational label:
insufficient references produce no calibration metrics.
