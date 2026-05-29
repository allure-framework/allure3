---
name: allure-agent-mode-setup
description: Set up Allure agent-mode guidance in a project by checking whether Allure results already exist, adding a short root AGENTS.md router, and creating docs/allure-agent-mode.md for downstream test authoring and review work.
---

# Allure Agent Mode Setup

Use this skill when a project wants to adopt Allure agent-mode for test work and test reviews.

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.
- Use `allure agent` for smoke checks too, even when the change is small or mechanical.
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
5. Keep the helper-command descriptions short and practical. Include `allure agent latest`, `allure agent state-dir`, `allure agent select --latest` / `--from <output-dir>`, and `allure agent --rerun-latest` / `--rerun-from <output-dir>` as small Helpful Commands entries so agents can recover the latest output directory, inspect where state is stored, inspect the review-targeted test plan, and rerun the same focused scope. Add one compact Advanced Reruns section that documents `--rerun-preset`, `--rerun-environment`, `--rerun-label`, and `ALLURE_AGENT_STATE_DIR` without turning the guide into a full CLI reference. Keep the verification section explicit that agents should print the run's `index.md` path after test execution.
6. Keep changes minimal and additive. Preserve unrelated project guidance in `AGENTS.md`.

## Files To Use

- Project guide template: `references/project-guide-template.md`
- Root router snippet: `references/root-agents-snippet.md`

## Guardrails

- Keep `AGENTS.md` short. It should route, not duplicate the whole guide.
- Keep helper-command notes short. Prefer one-line descriptions over a growing command catalog.
- Do not invent project-specific metadata conventions unless the repo already uses them.
- Do not create persistent output or expectations paths in the project guide. Those are per-run temp artifacts.
- If the project already has better Allure instructions, merge carefully instead of overwriting them.
