---
name: allure-agent-mode-feature-delivery
description: Use Allure agent-mode to design or review test scope, create per-run expectations, run targeted tests, review runtime evidence, and iterate until the test loop is acceptable.
---

# Allure Agent Mode Feature Delivery

Use this skill for feature or bug work that changes tests, for reviewing existing tests, auditing coverage, triaging failing suites, investigating weak evidence, or debugging flaky and environment-sensitive failures.

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.
- Use `allure agent` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.

## Read First

If the project has `docs/allure-agent-mode.md`, read it before writing or reviewing tests.

If it does not, use the guidance in this skill and suggest running the setup skill later.

## Workflow

1. Understand the feature, issue, or review goal and decide the intended test scope.
2. Create a fresh expectations file for this run in a temp directory.
3. Write or update the tests, or keep the current tests unchanged if the task is review-only.
4. Run only the intended scope with `allure agent` before relying on raw console output.
5. Review `index.md`, `manifest/run.json`, `manifest/tests.jsonl`, `manifest/findings.jsonl`, and the relevant test markdown files before inspecting source code.
6. If evidence is weak, enrich the tests with real steps, attachments, or minimal metadata.
7. Rerun with a new temp output directory and a new expectations file.
8. Accept only when scope matches, evidence is good enough to review, and any partial runtime modeling has been called out explicitly.

## Review Variants

### Small Test Change Workflow

1. Create a fresh expectations file and temp output directory for the touched scope.
2. Run the touched scope with `allure agent`, even if the goal is only a smoke check after a mechanical change such as typing cleanup, mock refactors, or helper extraction.
3. Review `index.md`, `manifest/run.json`, `manifest/tests.jsonl`, and `manifest/findings.jsonl`.
4. Only then make a final statement about regression safety or test correctness.

### Coverage Review Workflow

1. Split command or package audits into scoped groups.
2. Give each group its own expectations file and temp output directory.
3. Run each group with `allure agent`.
4. Review runtime artifacts first, then inspect source code only after the run explains what actually executed.
5. Mark the review incomplete until each scoped group either matched expectations or was explicitly documented as a broad package-health audit.

Compact coverage-review pattern:

```bash
TMP_DIR="$(mktemp -d)"
EXPECTATIONS="$TMP_DIR/expectations.yaml"

npx allure agent \
  --output "$TMP_DIR/agent-output" \
  --expectations "$EXPECTATIONS" \
  -- npm test -- <scope>
```

Coverage-review expectations example:

```yaml
goal: Review package tests
task_id: package-review
expected:
  label_values:
    module: my-module
notes:
  - Review runtime evidence before source inspection.
```

## Requirements

- Every run must use a unique temp `ALLURE_AGENT_OUTPUT`.
- Every run must use a unique temp `ALLURE_AGENT_EXPECTATIONS`.
- Parallel runs must never share those paths.
- Prefer YAML expectations in v1.
- Broad package-health audits may omit expectations, but the review must call out that scope checks are weaker.
- Metadata enrichment is part of this loop, not a separate workflow.

## Guardrails

- Runtime first, source second.
- Steps must represent real behavior, not filler.
- Attachments must come from the current execution.
- Keep metadata minimal and only add labels that help review or policy.
- Prefer helper-boundary instrumentation over repetitive caller wrapping.
- If runner-visible failures are not represented as logical tests, inspect global stderr and treat the run as a partial runtime review.

## Reference Files

- Expectations example: `references/expectations-example.yaml`
