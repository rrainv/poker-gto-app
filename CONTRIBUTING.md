# Contributing to Riverline

All working rules (roles, tickets, verification tiers, git and file safety, module rule, report format) are in [AGENTS.md](AGENTS.md); project context is in [docs/BRIEF.md](docs/BRIEF.md) and the live queue in [docs/STATE.md](docs/STATE.md).
Keep each change focused, add tests when behaviour changes (especially poker maths), and explain the behaviour and verification in the pull request.
CI runs on pull requests, the integration branch and manual dispatch once the CI ticket lands (see [OWNER_DECISIONS](docs/design/decisions/OWNER_DECISIONS.md)); until then run the focused tests locally.
