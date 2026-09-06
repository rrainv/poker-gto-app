# First real reference source decision — September 6, 2026

Research for `REFERENCE-STRATEGY-002`. Public documentation and source-code
examples were read; no solver was run, purchase made, vendor contacted, or
external strategy dataset copied into this repository. All repository frequency
fixtures remain synthetic. Findings are acquisition feasibility, not poker
validation or source acceptance.

## Recommendation

1. **First distributable candidate: Riverline-owned HRC Pro calculations,
   manually exported through the product's supported export/save workflow.**
   This is a more concrete option than assuming commercial exports are forbidden
   or permitted. The published HRC v4+ EULA explicitly permits sharing results
   of authorized calculations, including commercial use. Exact tree/export
   compatibility and independent validation remain unresolved. Begin with one
   six-max 100bb BB-versus-BTN 2.5bb, no-rake node only if the actual export can
   represent every required assumption and action without loss.
2. **Parallel product strategy: user-owned local reference import.** Build one
   vendor adapter only after a legally usable sample and exact mapping are
   available. This avoids distributing a private user's dataset but still needs
   provenance, local-use permission, application acceptance and isolation from
   synced/exported historical evidence. The implemented slice is preview-only.

Neither recommendation authorizes buying a subscription or claiming solved GTO.
An inability to match the preferred node is a source decision, not permission to
collapse a different tree or silently approximate it.

## Options compared

| Source class / candidate | Technical feasibility and coverage | Cost | Rights | Reproducibility / maintenance |
|---|---|---|---|---|
| Licensed solver exports; HRC Pro self-generated candidate | Public docs cover cash settings, pre/postflop trees, sizing and sampling; plausible for the preferred preflop family; actual export schema uninspected | Pro public price $49.99/month; annual/non-recurring one-year shown $359.90, plus compute and independent review [1] | EULA expressly permits sharing/commercial use of results of authorized calculations; UI-only use, supported export/save only; no scraping or service backend [2] | Freeze build, inputs, abstraction, tree, sampling/convergence logs and native save. Repeat runs and independent method required. Moderate/high adapter and review cost |
| User-owned private solver exports | Fastest source access if a user already owns a usable exact export; selected node only | Existing license may mean no incremental license cost; conversion/review still costs effort | Ownership is not a license; review vendor-specific local-use terms. Private flag does not make redistribution legal | Preserve original version/fingerprint and parser version; user must revalidate changed exports. Vendor-specific adapters needed |
| Manually curated exact packs | Feasible for one fully documented node with 169 rows and supported actions; copying by eye risks rounding and omissions | Low tooling cost, high reviewer time | Own authored data or explicit permission for underlying observations; curation does not erase third-party rights | Dual entry/cross-check, exact provenance per pack, declared rounding. Cannot manufacture missing sizing/frequencies |
| Reproducible generated/derived packs; b-inary postflop-solver | Open Rust API exposes tree configuration, strategy and EV; postflop source, not a preflop 169-node corpus [4][5] | No software license fee for compliant use; compute, engineering and review can dominate | AGPL v3-or-later code; output rights depend on content and input rights [6]. Keep solver outside production runtime | Pin commit/toolchain, run inputs, tree, iterations, precision and independent checks. Upstream says development suspended and API changes may lack version changes [4] |
| TexasSolver derived research | README advertises JSON strategy dump; primarily a bounded postflop research candidate [7] | Open code plus compute/review; possible commercial licensing | AGPL file and README's extra binary/commercial statements need clarification before integration/distribution [7][8] | Pin revision, audit export layout and numerical precision. Vendor benchmark claims are not Riverline independent validation |
| Public educational ranges | Public access can be useful for manual study, often missing exact rake/tree/frequency semantics | Often free to read; licensing and reconstruction may cost effort | Publicly visible is not a reuse license. No exact, permission-complete public corpus was established in this pass | Usually poor reproducibility/versioning and incomplete node coverage; keep unavailable or explicitly comparative if reviewed |
| Synthetic/internal benchmark packs | Excellent deterministic schema, fallback and consumer tests; no production poker coverage | Low | Repository-owned fixture rights | Highly reproducible architecture tests; never evidence of poker quality or a production source |

Prices are the dollar amounts displayed on the public page when read; final
currency/taxes and subscription terms depend on checkout. No quote for review,
conversion, compute time or a separate data license was obtained.

## Licensing finding that changes the first-source decision

HRC's EULA says:

> “the Licensee is permitted to distribute, openly share, or use the results of
> authorized calculations for commercial purposes, provided these results were
> produced by the Licensee in compliance with this Agreement and applicable law.”

It also says:

> “Automated scraping of information from the Product's user interface or memory
> is expressly prohibited. Results should only be exported using the export and
> save options provided within the Product.”

The same document limits use to the provided launcher/UI and prohibits making
the product available to others, including a service backend [2]. Therefore the
recommended workflow is a human-operated authorized calculation and export,
followed by offline Riverline conversion and review. Do not scrape, invoke an
undocumented automation API, share license keys, or embed HRC as a runtime service.
The license-key terms are additional and describe single-user, off-table use [3].
Recheck the actual installed version and license terms at acquisition time.

This permission applies to the licensee's authorized results. It does not grant
rights to somebody else's commercial range library, purchased chart collection,
or third-party input data. No commercial source was imported in this ticket.

## Public technical material inspected

The b-inary README documents Discounted CFR, numerical precision, compression,
and save/load features, while warning that upstream development is suspended
and breaking changes can occur without version changes [4]. Its basic Rust
example specifies ranges, cards, starting pot, effective stack, rake and sizing,
then queries strategy/EV at a selected node [5]. These are useful acquisition
fields, not an accepted preflop corpus. Its license section 2 says program output
is covered only when the output's content constitutes a covered work [6]. That
distinction supports evaluating an isolated offline generator, not automatically
licensing arbitrary ranges or embedding the solver into Riverline.

TexasSolver's README advertises JSON export, but its licensing prose is not a
clean basis for automatic integration: it labels the project AGPL while also
describing additional binary-sharing and commercial restrictions [7][8]. Treat
this as a clarification item. We inspected documentation only, not benchmark
frequency data, and did not import its binaries or code.

PioSOLVER UPI/terms pages and the attempted GTO Wizard terms URL returned HTTP 403
in this environment. Their current export rights, supported automation and price
were not established. They remain vendor-specific candidates, not recommended
redistribution sources based on reputation. HRC's explicit published output
permission is stronger evidence available in this pass.

## Acquisition and independent validation gate

Before any production registration, retain a review packet outside the production
runtime containing:

- exact source/build/version, native original export and SHA-256, parser version,
  lawful acquisition and applicable result/input redistribution permission;
- exact rules including rake timing/cap, positions, stack semantics, initial
  ranges/bunching assumptions, abstraction and every included/excluded branch;
- canonical unit/action mapping, source precision and serialization behavior;
  v1 allows one entry per action family and requires probability mass within
  `1e-12`. Multi-size raises, lossy rounding, postflop combos or partial rows
  cannot be silently merged, normalized or shoehorned into this contract;
- predeclared structural, action-legality, mass and representative/full-row
  mapping checks; independently reproduced or cross-method poker checks;
- convergence methodology, stopping criteria, repeat-run variability and known
  abstraction/solver limitations. A solver's marketing claim or its own
  convergence number is not independent general Hold'em validation;
- an application-owned decision binding source ID/version/SHA-256, exact node,
  capabilities and allowed claims. Comparative acceptance and separately accepted
  normative assessment are distinct decisions.

If an HRC export uses a richer sizing tree than v1 supports, choose a genuinely
matching deliberately bounded run, or schedule a reviewed representation extension.
Do not discard branches and preserve the old “exact” label. Export format and
floating-point precision are the first technical questions for the next source
ticket; obtaining a real sample and independent review remains
`RET-REFERENCE-PACK-001`.

## Sources read September 6, 2026

1. [HRC pricing and feature table](https://www.holdemresources.net/hrc/pricing).
2. [HRC v4+ EULA](https://www.holdemresources.net/legal/eula/hrc_v4), page last updated October 1, 2024.
3. [HRC license-key terms](https://www.holdemresources.net/legal/termsofuse) and [documentation index](https://www.holdemresources.net/docs).
4. [postflop-solver README](https://github.com/b-inary/postflop-solver/blob/main/README.md); read via GitHub raw content.
5. [postflop-solver basic example](https://github.com/b-inary/postflop-solver/blob/main/examples/basic.rs).
6. [postflop-solver AGPL license](https://github.com/b-inary/postflop-solver/blob/main/LICENSE) and [Desktop Postflop README](https://github.com/b-inary/desktop-postflop/blob/main/README.md).
7. [TexasSolver README](https://github.com/bupticybee/TexasSolver/blob/master/README.md).
8. [TexasSolver license](https://github.com/bupticybee/TexasSolver/blob/master/LICENSE).

The GitHub links use moving upstream branches: these are research citations,
not immutable acquisition identities. Pin commits and hash actual artifacts
before any reproducible source acceptance.
