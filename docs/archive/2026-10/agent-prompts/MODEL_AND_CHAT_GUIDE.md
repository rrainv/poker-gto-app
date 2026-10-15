# Model and chat guide

This is a prompt-authoring guide. The ticket prompt remains authoritative.

## Suggested model selection

| Work | Suggested model | Reasoning |
|---|---|---|
| Bounded UI/CSS/docs/test repair | GPT-5.6 Terra | high |
| Cross-subsystem integration/refactor | GPT-5.6 Sol | high |
| Architecture audit, strategy contracts, poker math, calibration | GPT-5.6 Sol | extra high |
| Independent review of a high-risk patch | GPT-5.6 Sol | high or extra high |
| Mechanical follow-up after a reviewed ticket | same model as ticket | high or standard as needed |

Do not choose the most expensive mode by habit. Use stronger reasoning when semantic correctness, architecture, math, or broad dependency tracing requires it.

## Config changes

Before a new ticket, update `.codex/config.toml` only when the selected model or reasoning level changes.

Typical examples:

```toml
model = "gpt-5.6-terra"
model_reasoning_effort = "high"
```

```toml
model = "gpt-5.6-sol"
model_reasoning_effort = "xhigh"
```

`.codex/config.toml` is user-owned operational configuration. Agents must not stage or commit it unless a dedicated configuration ticket explicitly owns it.

## Chat rule

- new ticket → new chat
- current-ticket regression → same chat
- independent audit → new chat
- accepted ticket → retire chat after human commit

## Prompt rule

A prompt should say:

- model and reasoning
- new or same chat
- implement/inspect/review mode
- no-stage/no-commit policy

Do not rely on chat memory alone for architecture or backlog truth; cite repository documents.
