# Agent skills: sources

Canonical location for skills shared by Claude Code and Antigravity. `.claude/skills/<name>` are local NTFS junctions to these folders (`.claude/` is not tracked; recreate with `mklink /J .claude\skills\<name> .agents\skills\<name>`).

Third-party files are copied verbatim at a pinned commit, never tracking `main`. To update: fetch the new commit, read every changed file in full, re-vet, then update the hash here.

| Skill | Repo | Commit | Files | Local changes | Licence |
|---|---|---|---|---|---|
| review-animations | https://github.com/emilkowalski/skills | `2d228630ba1446365f614a108cb8252f1feda202` | `skills/review-animations/SKILL.md`, `STANDARDS.md` | none (upstream already sets `disable-model-invocation: true`) | MIT, `LICENSE.md` |
| break-ui | https://github.com/emilkowalski/skills | `2d228630ba1446365f614a108cb8252f1feda202` | `skills/break-ui/SKILL.md`, `CATALOG.md` | added `disable-model-invocation: true` to the frontmatter | MIT, `LICENSE.md` |
| better-accessibility | https://github.com/jakubkrehel/skills | `592aedc44d7d5b3e29740984252902f3e5402a1c` | `skills/better-accessibility/SKILL.md` | none | MIT, `LICENSE.md` |
| riverline-design | Riverline (Manager draft, SKILLS-001) | n/a | `SKILL.md` | adapted in part from the two repos above | project + MIT attribution, `LICENSE.md` |

Notes:
- better-accessibility links to six reference files (`focus-and-keyboard.md`, `forms.md`, `hit-areas.md`, `motion-and-zoom.md`, `screen-readers.md`, `semantics-and-aria.md`) and to sibling skills (`better-colors`, `better-typography`, `better-layout`, `better-writing`, `better-ui`, `better-interface`) that are not vendored. The SKILL.md rules stand on their own; those links are dead here.
- break-ui and review-animations mention sibling skills (`emil-design-eng`, `prototype`) that are not vendored.

Vetted and not installed (SKILLS-001):
- `dietrichgebert/ponytail` @ `09c434ab73ca43761c5d8b0c5d341926c2fba710` (MIT): session-wide persona mode that auto-triggers on any coding task and dictates reply endings, conflicting with the AGENTS.md report format; the intended install is a plugin whose SessionStart / UserPromptSubmit / SubagentStart hooks run Node scripts.
- `blader/humanizer` @ `8c307f367c91bd974002f10f2be2965d642c13df` (MIT): clean (no scripts, no fetches), but about 8k tokens, auto-triggers on any prose editing, and targets long-form AI prose rather than UI copy, which VOICE_GUIDE already governs. Candidate for later as a manual-only skill.
