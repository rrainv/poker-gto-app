# Contributing to Riverline GTO Workstation

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:
- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## Our Development Workflow
We use Git Flow. All direct commits to `main` are restricted.
1. Branch off `main` to a feature branch (e.g., `feature/add-tightness-slider`).
2. Write your code and push it.
3. Open a Pull Request back to `main`.

## Conventional Commits
We strictly follow [Conventional Commits](https://www.conventionalcommits.org/). This leads to more readable messages that are easy to follow when looking through the project history, and allows us to generate automatic changelogs.

**Format:**
`<type>[optional scope]: <description>`

**Common Types:**
- `feat:` A new feature.
- `fix:` A bug fix.
- `docs:` Documentation only changes.
- `style:` Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
- `refactor:` A code change that neither fixes a bug nor adds a feature.
- `perf:` A code change that improves performance (e.g., `perf: patched zero-gc memory leak`).
- `test:` Adding missing tests or correcting existing tests.
- `build:` Changes that affect the build system or external dependencies.

**Example Commits:**
- `feat(ui): added tightness slider`
- `fix(worker): patched zero-gc memory leak in equity simulator`
- `docs: updated README with architecture details`
- `build: finalize production architecture and initialize open-source repository`
