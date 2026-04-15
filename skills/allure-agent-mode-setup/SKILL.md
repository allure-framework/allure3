---
name: allure-agent-mode-setup
description: Set up Allure agent-mode guidance in a project by checking whether Allure results already exist, adding a short root AGENTS.md router, and creating docs/allure-agent-mode.md for downstream test authoring and review work.
---

# Allure Agent Mode Setup

Use this skill when a project wants to adopt Allure agent-mode for test work and test reviews.

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure run`. It preserves the original console logs and adds agent-mode artifacts when you need them.
- Use `allure run` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.

## Goal

Leave the project with:

- a root `AGENTS.md` that routes test work to `docs/allure-agent-mode.md`
- a project `docs/allure-agent-mode.md` guide
- enough Allure bootstrap guidance for the agent to continue, even if the project is not fully configured yet

## Workflow

1. Check whether the project already emits Allure results or already has Allure configuration.
2. If Allure is missing, add or suggest the smallest viable install/config path for the project. Treat this as best-effort bootstrap, not the main acceptance path.
3. Create or update root `AGENTS.md` so test-related work points to `docs/allure-agent-mode.md`.
4. Create `docs/allure-agent-mode.md` from the bundled template and adapt only the parts that must be project-specific.
5. Keep changes minimal and additive. Preserve unrelated project guidance in `AGENTS.md`.

## Files To Use

- Project guide template: `references/project-guide-template.md`
- Root router snippet: `references/root-agents-snippet.md`

## Guardrails

- Keep `AGENTS.md` short. It should route, not duplicate the whole guide.
- Do not invent project-specific metadata conventions unless the repo already uses them.
- Do not create persistent output or expectations paths in the project guide. Those are per-run temp artifacts.
- If the project already has better Allure instructions, merge carefully instead of overwriting them.
