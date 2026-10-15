# Reference integrity recovery evidence - September 26, 2026

Dated ticket evidence for `REFERENCE-INTEGRITY-RECOVERY-001`, not an accepted
checkpoint or another status authority. [QA](QA_BACKLOG.md) owns human acceptance;
[Return Queue](PRODUCT_RETURN_QUEUE.md) owns acquisition and historical disposition.

## Findings and repair

Before editing, HEAD was `67b6713` on `codex/stabilization`, following `ef902ba`
and `8bc315e`. The reference integration was uncommitted. Two focused regression
tests reproduced the default browser provider returning
`reference_pack.hrc.6max.100bb.v1`, effective `comparative_reference`, exact-frequency
permission and action-EV permission. The second used canonical six-player state:
UTG/HJ/CO fold to a 100bb BTN with a 20bb BB. Unknown multiway effective stack
still matched the pilot's null assumption. Both tests now return the existing
`heuristic_preflop` with exploratory authority and neither permission.

The removed pilot constructed hand-category frequencies and fixed EVs, including
85% raise / 15% call and 3.4 / 2.1 EV for premium BB hands, while declaring a
licensed solver export and accepted comparative validation. Its registry used
fingerprints computed from those same generated contents. No original export or
independent validation artifact supporting those declarations was located in the
inspected repository/handoff. Hash equality and plausible poker actions cannot
establish acquisition, provenance or acceptance.

The repair removes the pilot, its self-generated acceptance and normal activation.
It removes pilot-only multi-intake routing and duplicate-source registry widening,
and restores the bounded v1 heads-up validator/matcher: known finite effective
stack, one live opponent and required history facts. No multiway representation,
poker mathematics, persistence schema or heuristic engine was added.

Intake again uses asynchronous platform Web Crypto SHA-256. The audit's twelve
independent comparisons did not establish an incorrect custom hash; its removal
addresses needless custom cryptography and synchronous startup coupling. The
browser module now installs its bridge without importing/hashing any corpus.
Callers can still supply an explicitly validated intake or raw pack, acceptance
and assessment registries, custom fallback and the explicit synthetic test gate.
No top-level asynchronous intake or generalized loader/lifecycle system is needed.
ES-module top-level await is not inherently broken.

Normal uncovered decisions use the existing labelled heuristic; invalid/unavailable
inputs retain existing unavailable behavior. Manifest claims alone still cannot
authorize reference claims. Test fixtures remain synthetic, under tests, with
normal production registration rejected. No production reference or normative
assessment policy is registered.

## Preserved work and evidence boundaries

Explain language preservation, Replay improvements and dense-table fixes in the
inherited checkpoints remain intact. Existing working-tree reference styling in
logic/teacher/CSS/locales remains intact: it consumes resolved ClaimPolicy authority
or Strategy Truth, not manifest claims or source branding. AnalysisExplanation's
provenance authority is projected from ClaimPolicy. EN/RU/HE, RTL and PERF-001
invocation/invalidation boundaries are preserved; fallback regression asserts one
resolver call per incompatible/unavailable decision.

The external Gemini handoff's north-star and authority documents describe accepted
exact references and frozen history. Its wider reference corpus, learned-model and
solver plans are future intent, not proof of acquisition, licensing, human acceptance
or implementation correctness. The generated pilot conflicts with that intent and
the accepted contracts; those plans do not broaden this recovery.

`tests/solver/test_tree_benchmark.py` was inspected, not changed or executed. It
builds the existing 46-node heads-up preflop public tree. Numeric regret/average
table estimates and an assumed 4 GiB ceiling do not measure full-postflop solving,
actual host headroom or GPU performance. No solver/domain behavior changed, so the
solver suite was not run. The `ef902ba` "Beta Candidate" commit title does not close
the checked-in pending human QA or establish beta readiness.

## Historical evidence exposure

Code establishes possible exposure, not proof of actual affected records. No user
browser database was inspected; affected count and whether this build was used for
stored Training decisions remain unknown.

- `app/src/application/training-memory-service.mjs`: `answeredDecisionRecord`
  captures answer-time StrategyResult and evaluation ClaimPolicy through
  `createTrainingStrategyEvidence`. Same Spot reuses frozen evidence; Similar Spot
  resolves through the current provider.
- `app/src/training-memory/domain.mjs`: `createTrainingStrategyEvidence` preserves
  source/version, effective-authority snapshot, coverage, distribution/EV details,
  ClaimPolicy and internal evaluation. IndexedDB `riverline-training-memory` v1
  persists decisions; session caches can retain source identities/comparison counts.
- `app/src/application/strategy-truth.mjs`: `historicalStrategyTruth` deliberately
  does not consult current registries. Removing activation therefore does not revoke
  a frozen historical reference label or its reuse in Same Spot.
- Standard Saved Hand/Spot payloads (`app/src/saved-study-objects/domain.mjs`)
  store canonical state/context/replay and annotations, without StrategyResult or
  ClaimPolicy snapshots. Personal Training observations store observed actions and
  session/exercise provenance, not accepted reference authority. Hand Review and
  Study Inbox are ephemeral projections, with durability delegated to existing owners.

Misleading guidance could also have influenced user-written notes or Personal intent;
that influence cannot be reliably inferred from these paths. No historical records
were deleted, rewritten, reauthenticated or upgraded. `RET-REFERENCE-PACK-001`, with
the Training Memory owner, retains a separate product decision on annotation or
restriction that preserves originals. Any resulting persistence migration requires
separate approved scope; that portion stops at this documented dependency.

## Exact file ownership

Changed relative to the initial working tree:

- `app/src/application/reference-pack-v1.mjs`: removed inspected pilot-only coverage
  relaxations; now matches HEAD.
- `app/src/application/reference-source-intake.mjs`: removed custom sync hash/intake;
  restored platform asynchronous implementation; now matches HEAD.
- `app/src/application/strategy-provider.mjs`: removed pilot-only multi-source arrays;
  retained established single-pack/intake behavior; now matches HEAD.
- `app/src/application/strategy-source-authority.mjs`: removed pilot-only registry
  widening; retained exact identity/version/fingerprint binding; now matches HEAD.
- `app/src/application/strategy-provider-bootstrap.mjs`: removed pilot imports/defaults,
  retained explicit intake and provider-option compatibility.
- Removed initially untracked `app/src/reference-data/reference-pack-pilot-hrc.mjs`
  and `tests/reference_pack_pilot.test.mjs`; originals remain in the recovery snapshot.
- Added `tests/reference_integrity_recovery001.test.mjs` with six behavioral regressions.
- Updated `docs/project/REFERENCE_PACK_V1_SPEC.md`,
  `REFERENCE_SOURCE_FOUNDATION_V1_SPEC.md`, `REFERENCE_SOURCE_ACQUISITION_2026_09.md`,
  `QA_BACKLOG.md`, `PRODUCT_RETURN_QUEUE.md`, and this report.

Pre-existing work preserved byte-for-byte in `app/src/core/logic.js`,
`app/src/ui/teacher.js`, `app/src/ui/riverline-design.css`,
`app/src/locales/analysis-translations.js`, `.codex/config.toml`, `full_diff.patch`
and `status.txt`. Protected repo-dump files were untouched. Restored files being
clean against HEAD does not mean this ticket did not change their starting contents.
No roadmap sequencing or accepted capability status changed.

## Verification

Commands, counts and limitations are recorded below. Logs are outside the repository
at `C:/Users/sjzns/AppData/Local/Temp/Riverline_REFERENCE-INTEGRITY-RECOVERY-001_verification/`.
Environment: Windows, Node v22.23.2, Firefox 156.0.1. The browser tooling README
recommends Node 24+; this run used the installed version and made no environment
upgrade. No solver tests were run.

- Reproduction: `node --test tests/reference_integrity_recovery001.test.mjs`.
  First attempt: two failures from a test-helper missing Hero ID (not defect evidence).
  After correcting the helper: two expected source-identity failures. One diagnostic
  rerun confirmed both also granted comparative authority, exact frequencies and EV.
- Initial affected suite: `node --test tests/reference_integrity_recovery001.test.mjs tests/reference_pack001_foundation.test.mjs tests/reference_strategy002.test.mjs tests/strategy_authority001_provider.test.mjs tests/strategy_authority001a_heuristic_extraction.test.mjs`:
  42 passed, zero failed after the initial repair.
- Expanded recovery suite: five passed, one failed because the test used nonexistent
  `details.referenceSelection`. The established provider/consumer path is
  `details.providerSelection.referencePack`. Corrected the expectation, retained
  unsupported coverage and single-call assertions, and added incompatible versus
  unavailable query-state assertions. Rerun: six passed, zero failed.
- Final focused suite: `node --test tests/reference_integrity_recovery001.test.mjs tests/reference_pack001_foundation.test.mjs tests/reference_strategy002.test.mjs tests/strategy_authority001_provider.test.mjs tests/strategy_authority001a_heuristic_extraction.test.mjs tests/reference_authority001_claim_policy.test.mjs`:
  61 passed, zero failed (`focused.log`). Existing tests additionally cover manifest
  self-authorization denial, valid synthetic reference behavior and claim ceilings.
- Syntax: all six commands passed:
  `node --check app/src/application/reference-pack-v1.mjs`;
  `node --check app/src/application/reference-source-intake.mjs`;
  `node --check app/src/application/strategy-provider-bootstrap.mjs`;
  `node --check app/src/application/strategy-provider.mjs`;
  `node --check app/src/application/strategy-source-authority.mjs`;
  `node --check tests/reference_integrity_recovery001.test.mjs`.
- Scoped hygiene: `git diff --check -- app shared solver tests docs README.md` passed;
  Git emits only configured LF/CRLF conversion warnings. `rg` found no remaining
  pilot imports or custom synchronous intake/hash symbols under app/tests (exit 1
  means no matches).
- Full Node, run once: `node --test tests/*.test.js tests/*.test.mjs`:
  2,568 tests, 2,566 passed, two failed, zero skipped (304.95 seconds;
  `full-node.log`). One failure was a verification-ordering error: the documentation
  link check ran before this linked report was created. The other was the known
  embedded Electron/Explain sandbox failure (worker exit 1, empty diagnostics).
  This was not a clean full-suite pass; only the affected checks were rerun.
- Documentation rerun after creating the report:
  `node --test tests/docs_capability_dossiers001_integrity.test.mjs`:
  five passed, zero failed (`docs-rerun.log`).
- Exact embedded-browser rerun outside the sandbox:
  `node --test tests/explain_panel_interaction001.test.mjs`:
  one passed, zero failed (`explain-outside-sandbox.log`). No implementation or
  test changes were needed for that environment-specific failure.
- Firefox smoke: `node tests/tooling/verify_beta_candidate_browser.mjs`.
  First attempt in the sandbox failed before any app check at
  `browsingContext.create` with `DiscardedBrowsingContextError`
  (`firefox-smoke.log`). The same command outside the sandbox passed all 21 groups,
  with zero diagnostics, in 95.6 seconds (`firefox-outside-sandbox.log`):
  Firefox 156.0.1, 1920x1080 and 1366x768 at scale 1, including RU/HE RTL.
  No smoke code changed and no successful broad gate was repeated.

Independent read-only review found no actionable issues in strict coverage,
bootstrap compatibility, preserved effective-authority presentation or regression
coverage. It did not run browser gates or inspect databases.

## Small human acceptance checklist

1. Fresh Firefox session: Analyze a normal preflop spot and the BTN/short-BB case;
   source remains heuristic, with no HRC/reference, exact-EV or correctness claim.
2. Exercise Training then Review/Explain/Replay in EN, RU and HE/RTL; check preserved
   locale/disclosure behavior, readable source labels and table/replay layout.
3. If the affected build was previously used, review historical source labels without
   editing evidence and decide the separate historical-disposition scope. Do not
   interpret old frozen labels as newly authenticated references.

Automated browser results do not constitute subjective human acceptance.

## Recovery snapshot and Git

The original snapshot is preserved, not overwritten:
`C:/Users/sjzns/AppData/Local/Temp/Riverline_REFERENCE-INTEGRITY-RECOVERY-001_qf4yoeku/`.
It contains HEAD identity, initial status, tracked binary diff, index diff and copied
untracked files including both pilot source/test files. Git warned that unrelated
`.pytest_cache/` was unreadable; relevant pilot files were captured. `full_diff.patch`
alone was not used as a backup. Nothing was reset, cleaned, stashed, staged or
committed. No next ticket was started.
