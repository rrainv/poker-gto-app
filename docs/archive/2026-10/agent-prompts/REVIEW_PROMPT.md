# Independent reviewer prompt

Review the current ticket as if trying to break it.

Read:

- the ticket prompt/report
- `AGENTS.md`
- architecture/current-phase documents
- owned QA/Product backlog entries
- the actual Git diff and relevant runtime files

Check:

1. Did it satisfy every owned requirement?
2. Did it alter unrelated behavior or backlog items?
3. Did it create a second authority or bypass a versioned contract?
4. Did UI code introduce poker math?
5. Did poker math preserve semantics and invariants?
6. Are provenance claims honest?
7. Are tests behavioral/invariant-focused rather than source-text theater?
8. Did test discovery or coverage silently shrink?
9. Did performance/invalidation regress?
10. For UI work, was browser/manual visual verification performed? If not, is status honestly partial/unverified?
11. Are accessibility, RTL, long-copy, responsive, and empty/error states handled where owned?
12. Does the working tree contain unrelated or protected files?

Return:

- executive verdict: approve / approve after fixes / reject
- blocking issues
- non-blocking issues
- missing tests/evidence
- backlog status corrections
- exact repair scope, if needed
- verification results

Do not edit, stage, or commit unless the review ticket explicitly authorizes a repair.
