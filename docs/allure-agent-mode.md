# Allure Agent Mode

## Purpose

Use Allure agent-mode to review what the tests actually did, not just whether the command exited successfully.

Use it when:

- adding or updating tests for a feature or bug
- reviewing existing test suites, auditing coverage, or triaging failing suites
- validating that intended tests ran and unrelated scope did not drift in
- improving weak or low-signal runtime evidence
- preparing richer agent-mode reviews, quality gates, and future loop adoption

## Review Principle

Runtime first, source second.

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.
- Use `ALLURE_AGENT_*` with `allure run` only as the lower-level fallback when you need direct environment control.
- If the agent-mode output is missing or incomplete, debug that first and treat any console-only conclusion as provisional.

## Verification Standard

- Use `allure agent` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.
- After each agent-mode test run, print the `index.md` path from that run's output directory so users can open the run overview quickly.

## Repository Status

This repository already has a working Allure 3 setup.

- Root report configuration lives in `allurerc.mjs`.
- Most package test suites emit results with `allure-vitest/reporter` into `./out/allure-results`.
- The normal feature-delivery path here is to run a targeted workspace test command under `yarn allure agent -- ...`.
- You usually do not need to bootstrap Allure from scratch in this repo; focus on expectations, evidence quality, and scope control.

## Helpful Commands

- `allure agent latest` prints the latest agent output directory for the current project cwd. Use it when a prior run omitted `--output` and you want to reopen the most recent agent-mode artifacts.
- `allure agent state-dir` prints the state directory for the current project cwd. Use it when you need to inspect where `latest` pointers are stored or debug sandbox behavior.
- `allure agent select --latest` or `allure agent select --from <output-dir>` prints the review-targeted test plan from a prior agent run. Add `--preset failed` or exact `--label name=value` / `--environment <id>` filters when you need a narrower rerun plan.
- `allure agent --rerun-latest -- <command>` or `allure agent --rerun-from <output-dir> -- <command>` reruns only the selected tests through the framework-agnostic Allure testplan flow. The default rerun preset is `review`.

## Advanced Reruns

- `--rerun-preset review|failed|unsuccessful|all` changes how the rerun seed set is chosen. Use `review` for the default agent-targeted loop, `failed` for classic failure reruns, `unsuccessful` for any non-passed tests, and `all` when you want the whole previously observed set.
- `--rerun-environment <id>` narrows the rerun selection to one or more environment ids from the previous agent output. Repeat the flag for multiple environments.
- `--rerun-label name=value` narrows the rerun selection to tests whose prior results carried exact matching labels. Repeat the flag for multiple label filters.
- `ALLURE_AGENT_STATE_DIR` overrides the default project-scoped state directory used by `allure agent latest`, `allure agent state-dir`, and `--rerun-latest`. Use it when you need a deterministic shared location in CI or a constrained sandbox.

## Core Loops

### Test Review Loop

1. Identify the exact review scope.
2. Create a fresh expectations file for this run in a temp directory.
3. Run only that scope with `allure agent`.
4. Read `index.md`, `manifest/run.json`, `manifest/tests.jsonl`, and `manifest/findings.jsonl`.
5. Read per-test markdown only for tests that failed, drifted, or have findings.
6. Only after runtime review, inspect source code for root cause or coverage gaps.
7. If evidence is weak or partial, enrich the tests and rerun.
8. When iterating on the same scope, prefer `allure agent --rerun-latest -- <command>` or `allure agent --rerun-from <output-dir> -- <command>` so the rerun stays focused on the review-targeted tests.

### Feature Delivery Loop

1. Understand the feature or issue and the intended test scope.
2. Create a fresh expectations file for this run in a temp directory.
3. Write or update the tests.
4. Run the target scope with `allure agent`.
5. Review `index.md`, `manifest/run.json`, `manifest/tests.jsonl`, `manifest/findings.jsonl`, and the relevant per-test markdown files.
6. Fix scope drift, weak evidence, or bad test design.
7. Rerun with a new temp output directory and a new expectations file until the run is acceptable.

### Metadata Enrichment Loop

Use this when the run is functionally correct but too weak to review:

1. Identify missing or low-signal findings in agent output.
2. Add real steps, attachments, or minimal metadata only where they improve review quality.
3. Rerun the same intended scope.
4. Reject the run if noop-style or placeholder evidence remains.

### Small Test Change Workflow

Use this when the code change is mostly mechanical, such as typing cleanup, mock refactors, or helper extraction:

1. Create a fresh expectations file and temp output directory for the touched scope.
2. Run the touched scope with `allure agent`, even if the goal is only a smoke check after a small or mechanical change.
3. Review `index.md`, `manifest/run.json`, `manifest/tests.jsonl`, and `manifest/findings.jsonl`.
4. Only then make a final statement about regression safety or test correctness.

### Coverage Review Workflow

Use this for command matrices, package audits, or business-logic coverage reviews:

1. Split the audit into scoped groups.
2. Give each group its own expectations file and temp output directory.
3. Run each group with `allure agent`.
4. Review runtime artifacts first, then inspect source code only after the run explains what actually executed.
5. Mark the review incomplete until each scoped group either matched expectations or was explicitly documented as a broad package-health audit.

## Per-Run Artifacts

Each run must use fresh temp paths so parallel runs stay isolated. `allure agent` creates a fresh temp output directory automatically when you omit `--output`, but this guide still uses explicit temp paths when you need deterministic file locations.

- `ALLURE_AGENT_OUTPUT` should point to a unique temp directory per run.
- `ALLURE_AGENT_EXPECTATIONS` should point to a unique expectations file per run.
- Do not reuse output or expectations paths across parallel runs.

YAML is the preferred format for expectations files in v1, though JSON also works.

Example:

Primary pattern:

```bash
TMP_DIR="$(mktemp -d)"
EXPECTATIONS="$TMP_DIR/expectations.yaml"
cat >"$EXPECTATIONS" <<'YAML'
goal: Validate feature A
task_id: feature-a
expected:
  environments:
    - default
  full_name_prefixes:
    - feature A
  label_values:
    feature: feature-a
notes:
  - Only feature A tests should run.
YAML

npx allure agent \
  --output "$TMP_DIR/agent-output" \
  --expectations "$EXPECTATIONS" \
  -- npm test
```

Lower-level fallback:

```bash
ALLURE_AGENT_OUTPUT="$TMP_DIR/agent-output" \
ALLURE_AGENT_EXPECTATIONS="$EXPECTATIONS" \
npx allure run -- npm test
```

Repository-oriented examples:

Review an entire package:

```bash
TMP_DIR="$(mktemp -d)"
EXPECTATIONS="$TMP_DIR/expectations.yaml"
cat >"$EXPECTATIONS" <<'YAML'
goal: Review CLI package tests
task_id: cli-package-review
expected:
  label_values:
    module: cli
notes:
  - Review runtime evidence before source inspection.
YAML

yarn allure agent \
  --output "$TMP_DIR/agent-output" \
  --expectations "$EXPECTATIONS" \
  -- yarn workspace allure test
```

Compact coverage-review pattern:

```bash
TMP_DIR="$(mktemp -d)"
EXPECTATIONS="$TMP_DIR/expectations.yaml"

yarn allure agent \
  --output "$TMP_DIR/agent-output" \
  --expectations "$EXPECTATIONS" \
  -- yarn workspace <workspace> test <scope>
```

Package review expectations example:

```yaml
goal: Review package tests
task_id: package-review
expected:
  label_values:
    module: my-module
notes:
  - Review runtime evidence before source inspection.
```

Review a single spec:

```bash
TMP_DIR="$(mktemp -d)"
EXPECTATIONS="$TMP_DIR/expectations.yaml"
cat >"$EXPECTATIONS" <<'YAML'
goal: Review CLI run integration coverage
task_id: cli-run-integration-review
expected:
  label_values:
    package: test.commands.run.integration.test.ts
notes:
  - Review runtime evidence before source inspection.
YAML

yarn allure agent \
  --output "$TMP_DIR/agent-output" \
  --expectations "$EXPECTATIONS" \
  -- yarn workspace allure test test/commands/run.integration.test.ts
```

Single-spec expectations example:

```yaml
goal: Review one spec
task_id: single-spec-review
expected:
  label_values:
    package: test.commands.run.integration.test.ts
notes:
  - Review runtime evidence before source inspection.
```

```bash
TMP_DIR="$(mktemp -d)"
EXPECTATIONS="$TMP_DIR/expectations.yaml"
cat >"$EXPECTATIONS" <<'YAML'
goal: Validate plugin-agent behavior
task_id: plugin-agent
expected:
  label_values:
    package: test.index.test.ts
notes:
  - Only plugin-agent tests should run.
YAML

yarn allure agent \
  --output "$TMP_DIR/agent-output" \
  --expectations "$EXPECTATIONS" \
  -- yarn workspace @allurereport/plugin-agent test
```

```bash
TMP_DIR="$(mktemp -d)"
EXPECTATIONS="$TMP_DIR/expectations.yaml"
cat >"$EXPECTATIONS" <<'YAML'
goal: Validate CLI run integration coverage
task_id: cli-run-integration
expected:
  label_values:
    package: test.commands.run.integration.test.ts
YAML

yarn allure agent \
  --output "$TMP_DIR/agent-output" \
  --expectations "$EXPECTATIONS" \
  -- yarn workspace allure test test/commands/run.integration.test.ts
```

## Reviewing Agent Output

Read in this order:

1. `index.md`
2. `manifest/run.json`
3. `manifest/tests.jsonl`
4. `manifest/findings.jsonl`
5. the relevant `tests/<environment>/<slug>.md`
6. copied attachments under `.assets/` and process logs under `artifacts/global/`

Questions to answer:

- Did only the intended tests run?
- Did the test prove the intended behavior?
- Is the runtime evidence strong enough to understand the result?
- Are there smells like noop steps, step spam, or generic attachments?

## When Console Errors Are Not Represented As Test Results

- Suite-load, import, or setup failures may appear only in `artifacts/global/stderr.txt` or global errors.
- If `manifest/tests.jsonl` does not account for all visible failures from the test runner, inspect global stderr before concluding the run is fully modeled.
- Treat that state as a partial runtime review, not as a clean or complete result set.
- If runner-visible failures are present outside logical test files, final conclusions must stay provisional until the missing modeling is understood.

## Test Design Best Practices

- Prefer a small setup/action/assertion story over event-by-event noise.
- Write tests that prove the intended behavior precisely and avoid unrelated actions.
- Use helper-boundary instrumentation when several call sites need the same evidence.
- Keep metadata minimal and purposeful.
- Add labels only when they help scope review, debugging, or downstream policy.

Good helper-boundary example:

- instrument `runCommand` once instead of wrapping every `runCommand(...)` call site in identical steps

## Evidence Rules

### Steps

Valid steps:

- real setup actions
- real user or API actions
- real state transitions
- real assertions and checks

Invalid steps:

- empty wrapper steps
- steps named only `success`, `done`, or similar generic outcomes
- steps that repeat logs without clarifying behavior

### Attachments

Valid attachments:

- request and response payloads
- logs tied to the failing or verifying point
- screenshots, DOM snapshots, diffs, traces
- compact summaries derived from actual runtime data

Invalid attachments:

- static placeholder text like `test passed`
- generic “success” notes with no runtime evidence
- artifacts not tied to the current execution

## Metadata Rules

- Add feature or task labels when the run is scoped by feature or task.
- Add severity only when it matters for review or quality-gate policy.
- Keep owner, epic, story, layer, and similar taxonomy optional unless the project already uses them.
- Do not add metadata that no expectation, review step, or policy consumes.

## Acceptance Rules

Accept the run only when:

- scope matches expectations
- evidence is strong enough to explain what happened
- retries include per-attempt diagnostics when needed
- no high-confidence noop or placeholder findings remain

Iterate again when:

- expected tests are missing
- unrelated tests or environments appeared
- steps are empty or uninformative
- attachments are missing or low-signal
- metadata drift makes scope review ambiguous

### Review Completeness

A test review is not complete unless:

- the relevant scope was run with agent mode, unless that is impossible
- expectations were created for the intended scope, unless this is a broad package-health audit
- agent artifacts were reviewed before final conclusions
- missing or partial runtime modeling was called out explicitly
- console-only conclusions are treated as provisional when agent output is absent or incomplete

## Future Loops

These are planned, but not part of the first stable core:

- flaky detection and fix loop
- known-issue and mute loop
- quality-gate installation and adoption loop

When these loops are added, they should build on the same evidence rules used here rather than bypassing them.
