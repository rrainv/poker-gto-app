# Third-party register

Every outside component, dataset, asset and tool Riverline uses or plans to use, with its licence and what it allows. Created by DOCS-PHASE1-001 (2026-10-26) under the owner-approved **sourcing policy LT-04** (2026-10-21, [LONG_TERM_NOTES](design/decisions/LONG_TERM_NOTES.md)):

1. **Quality first:** pick the best option for users.
2. **Legal certainty always:** every outside component, dataset or tool gets a row here, with its licence and allowed uses, **before** it is used.
3. **Reuse permissive code** (MIT, Apache, BSD) freely, with notices.
4. **Copyleft** (GPL, AGPL) only if we accept its terms for the whole app, decided explicitly, never slipped in. No AGPL code inside the app (LT-02).
5. **Buy** when the price is fair and the terms allow our use, including redistribution and paid tiers. Nothing is bought yet (LT-07: free first, no spending committed).
6. **Build ourselves** when no lawful option is good enough or the part is core to the brand (the truth/maths engine).
7. **Never** ship data from a tool whose terms forbid it, never scrape, never copy chart values, never download third-party charts, even for measurement (R-01, 2026-10-21).
8. **Professional legal review** before the first public release and before any paid offering.

Why it matters: the business model is mostly free with a possible paid supporter tier later, and the source model (closed or open) is decided only after the best tools' licences are known (LT-02). Every row below must therefore say whether it allows **closed**, **open**, **free** and **paid** distribution. Licence facts come from the package metadata, the vendored LICENSE files or the research reports; research-derived rows are **to verify** (not legal advice). `UNKNOWN` means nobody has checked yet: resolve it before the component ships to anyone outside the owner.

Columns: **Ships** = whether the thing is distributed with Riverline (in the app, its installer or its data), versus dev-only or internal. **Allowed uses** = closed / open / free / paid distribution as far as known.

## In the repository today

### Runtime (shipped)

| Component | Version | Where | Licence | Ships | Allowed uses | Notes |
|---|---|---|---|---|---|---|
| `@supabase/supabase-js` (+ `auth-js`, `functions-js`, `postgrest-js`, `realtime-js`, `storage-js`, `@supabase/phoenix`) | 2.112.3 (phoenix 0.4.5) | `app/package.json`; UMD bundle shipped by electron-builder | MIT | yes (Electron build; browser mode loads the local UMD) | closed, open, free, paid; keep the MIT notice | Accounts/sync are off the critical path (M1/M2 local-only) |
| `iceberg-js` | 0.8.1 | transitive (Supabase) | MIT | in `node_modules` only; not in the shipped UMD file list | as above | |
| `tslib` | 2.8.1 | transitive (Supabase) | 0BSD | as above | as above | |
| Supabase hosted service | — | optional sign-in and sync | service terms (not a code licence) | no (remote service) | UNKNOWN for a paid tier; free tier pauses after 7 idle days (R-07) | Needs privacy disclosures before accounts go live (§7.11) |
| Freesound poker foley (15 Ogg files) | downloaded 2026-08-23 | `app/assets/audio/foley/` | CC0 1.0 (per file, recorded in [PROVENANCE.md](../app/assets/audio/foley/PROVENANCE.md) and `AudioFoleyManifest.js`) | yes | closed, open, free, paid; no attribution required | **These are Freesound's Ogg previews, not the full-quality originals** that P1-11 and the earlier audio rule ask for; to be replaced by the listening-page choice (AUDIO-RESEARCH-001) |
| Character portraits (Cleo, Fern, Luma, Mika, Nova, Otto, Pip, Remy, Sol, Zig; PNG + WebP derivatives) | 2026-09-07 | `app/src/ui/assets/opponents/` | UNKNOWN: generated with an AI image tool ("built-in imagegen tool", [PROMPTS.md](../app/src/ui/assets/opponents/PROMPTS.md)); the generator's output terms are not recorded | yes | UNKNOWN | Temporary Beta art; final art replaces it (M3). Record the generator and its terms before any outside release |
| Brand mark (`riverline-brand-mark.svg`) and inline UI icons in `app/index.html` | — | app | UNKNOWN (no origin recorded; assumed project-made) | yes | UNKNOWN | Confirm origin; the owner keeps the current icon set (NORTH_STAR §8) |
| Rubik (variable, woff2) | Rubik 2015 (The Rubik Project Authors); packaged by `@fontsource-variable/rubik` 5.3.0, fetched 2026-10-27 | `app/src/ui/assets/fonts/rubik/` (Latin, Latin Extended, Cyrillic, Cyrillic Extended, Hebrew; normal, weights 300–900), licence copied as `OFL.txt` there | SIL Open Font License 1.1 | yes (self-hosted, `@font-face` in `app/styles.css`; no runtime font CDN) | closed, open, free, paid; may be bundled and redistributed with software; keep the licence text with the files; the font may not be sold on its own; no Reserved Font Name is declared | DS-TOKENS-001 (DS-FONT-RUBIK): `--font-display` (workspace titles, headings, verdicts, big numbers); body text keeps the system UI font. Source: <https://github.com/googlefonts/rubik> via Fontsource |
| System fonts: Avenir Next, Segoe UI Variable, Segoe UI, Cascadia Mono, system-ui | — | `app/styles.css` font stacks | OS-supplied fonts (Apple / Microsoft); not bundled | no (referenced by name only) | fine as long as they are not redistributed | Bundling any of them would need its own licence check |

### Desktop host and build (dev / packaging)

| Component | Version | Where | Licence | Ships | Allowed uses | Notes |
|---|---|---|---|---|---|---|
| Electron | ^30.0.0 | `app/package.json` devDependency | MIT (bundles Chromium and Node, each with their own notices) | yes, as the Windows installer runtime | closed, open, free, paid; ship the Electron/Chromium licence notices with the installer | Thin host only |
| electron-builder | ^24.13.3 | `app/package.json` devDependency | MIT | no (build tool) | any | NSIS installer |
| Node.js (runtime, built-in `node:test` runner) | engines ≥ 22, `.nvmrc` 24 | dev server, tests | MIT | no | any | |

### Tests and tooling (dev only)

| Component | Version | Where | Licence | Ships | Allowed uses | Notes |
|---|---|---|---|---|---|---|
| `puppeteer-core` | 25.10.0 | `tests/tooling/package.json` | Apache-2.0 | no | any | Drives Firefox for the Beta smoke and audits |
| Mozilla Firefox | installed | browser acceptance | MPL-2.0 | no (user-installed tool) | any | Primary acceptance browser |
| Python 3 standard library | 3.12 | `solver/`, `tests/solver/`, `server.py` | PSF licence | no | any | Solver research uses the standard library only (no third-party Python packages found) |

### Vendored agent skills (dev only)

Pinned copies; details in [.agents/skills/SOURCES.md](../.agents/skills/SOURCES.md).

| Component | Pinned commit | Licence | Ships | Allowed uses |
|---|---|---|---|---|
| `review-animations` (emilkowalski/skills) | `2d22863` | MIT | no | any; keep `LICENSE.md` |
| `break-ui` (emilkowalski/skills) | `2d22863` | MIT | no | any; keep `LICENSE.md` |
| `better-accessibility` (jakubkrehel/skills) | `592aedc` | MIT | no | any; keep `LICENSE.md` |
| `riverline-design` (project skill, adapted in part from the two repos above) | n/a | project + MIT attribution | no | internal |

### Research and design material (internal)

| Item | Where | Terms | Ships | Notes |
|---|---|---|---|---|
| Gemini research reports (R-01 … R-10, LT-06, skills, master synthesis) | [docs/research/](research/README.md) | generated by Google Gemini on the owner's account; Google's terms for generated content apply | no | Evidence only; not legal advice; their third-party quotes are not copied into the product |
| Mockups and canvases (claude.ai artifacts) | links in [STATE.md › Design canvases](STATE.md#design-canvases) | owner's artifacts | no | Visual references; numbers come from the engine |
| Design kit assets (card backs, icons, measurements from the app) | [docs/design/mockup-assets/](design/mockup-assets/) | project material | no | MOCKUP-ASSETS-001 |

## Planned or candidate (not in the repository)

| Component | Status | Licence | Allowed uses | Rule / source |
|---|---|---|---|---|
| **b-inary/postflop-solver** | planned for offline generation (SOLVER-PILOT-001 needs the Rust toolchain: open decision) | AGPL-3.0 (code) | **Code never inside the app** (would force the whole app to AGPL). Its **numerical output**, converted to Riverline's own data format, may ship in closed or open, free or paid builds per the FSF FAQ cited in LT-06 (**to verify**: quote the FSF FAQ and the repo licence ourselves before relying on it) | LT-03, LT-06, R-01 |
| Rubik (heading face) | candidate approved in direction (P1-30: "looks good") | SIL Open Font License 1.1 (to verify on the font files used) | closed, open, free, paid; may be bundled; may not be sold on its own; keep the OFL notice | **Self-host** the files; no Google Fonts requests at runtime (mockup review 2026-10-26; the CSP already allows only `font-src 'self' data:`) |
| Kenney audio packs (Sound set 1) | candidate (R-06) | CC0 1.0 | closed, open, free, paid; no attribution required | Judged by ear on the listening page |
| Freesound recordings (Sound set 2) | candidate (R-06) | CC0 1.0 or CC-BY (per file) | CC0: any. CC-BY: any use **with a credit line in About & legal** (owner choice 2026-10-26: CC0 preferred, CC-BY allowed) | Never CC-BY-NC |
| Sonniss GDC bundles, Zapsplat, Mixkit, Pixabay audio | **excluded from the repo** (R-06) | licences forbid shipping raw files with source code | packaged builds only; never in the repo (a trap if Riverline becomes open source) | owner rule 2026-10-26 |
| BBC Sound Effects, Freesound CC-BY-NC | **excluded** | non-commercial | none for Riverline | R-06 |
| HRC Pro (preflop / multiway / push-fold) | **deferred** (LT-07: free first) | commercial EULA (≈ US$360/year per LT-06); exported results may be distributed commercially via HRC's own export functions (**to verify** the EULA clause) | paid licence needed | Keep invoices and export logs if ever bought |
| PioSOLVER, GTO+, Simple Postflop | **avoid shipping their outputs** | Pio: on-demand lookup needs a business licence; GTO+: personal non-commercial; Simple Postflop: written permission | none for shipped data | LT-06 |
| TexasSolver | skipped | contradictory licence claims, accuracy doubts | none | LT-06 |
| MonkerSolver outputs | not planned | appears allowed by silence (LT-06) | UNKNOWN | HRC preferred if ever needed |
| Own-solver building blocks: exinori/DCFR-SOLVER, conorarmstrong/noregrets, krukah/robopoker, slumbot2019 | candidates (R-01, R-01b) | MIT (per R-01; **to verify** each repo) | any, with notices; used in a separate solver tool, data shipped | own fixed-tree preflop, push/fold, multiway research |
| b-inary/poker-cfr | candidate (R-01) | BSD (per R-01; to verify) | any, with notices | exact push/fold reference |
| OpenSpiel | candidate (R-01) | Apache-2.0 (to verify) | any, with notices | research harness |
| GTOpen, DeepFold, DecisionHoldem | **avoid** (R-01) | unlicensed repos / opaque binaries | none | |
| Free preflop charts (GTO Wizard, Upswing, FreeBetRange and similar) | **never downloaded or copied, not even for measurement** | proprietary | none | R-01; NORTH_STAR §3.3 |
| QR decoder for PC webcam scanning | candidate (R-07; owner wants it if cheap) | must be MIT or Apache | any | pick and record before use |

Add a row before adding anything new (a package, a font, a sound, an image, a dataset, a solver output, a vendored file). When a candidate is adopted, move it to the first section with its version and file location.
