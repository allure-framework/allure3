# Allure Agent Mode

Use Allure agent-mode to design, review, validate, debug, and enrich tests in this project.

## Review Principle

Runtime first, source second.

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure run`. It preserves the original console logs and adds agent-mode artifacts when you need them.
- If the agent-mode output is missing or incomplete, debug that first and treat console-only conclusions as provisional.

## Verification Standard

- Use `allure run` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.

## Core Loops

### Test Review Loop

1. Identify the exact review scope.
2. Create a fresh expectations file for this run in a temp directory.
3. Run only that scope with `allure run`.
4. Read `index.md`, `manifest/run.json`, `manifest/tests.jsonl`, and `manifest/findings.jsonl`.
5. Read per-test markdown only for tests that failed, drifted, or have findings.
6. Only after runtime review, inspect source code for root cause or coverage gaps.
7. If evidence is weak or partial, enrich the tests and rerun.

### Feature Delivery Loop

1. Understand the feature or issue.
2. Create a fresh expectations file for this run in a temp directory.
3. Write or update the tests.
4. Run the target scope with `allure run`.
5. Review `index.md`, manifests, and per-test markdown.
6. Enrich tests when evidence is weak.
7. Rerun until scope and evidence are acceptable.

### Metadata Enrichment Loop

Use this when the run is functionally correct but too weak to review:

1. Identify missing or low-signal findings.
2. Add real steps, attachments, or minimal metadata.
3. Rerun the same intended scope.
4. Reject noop-style or placeholder evidence.

### Small Test Change Workflow

1. Create a fresh expectations file and temp output directory for the touched scope.
2. Run the touched scope with `allure run`, even if the goal is only a smoke check after a mechanical change such as typing cleanup, mock refactors, or helper extraction.
3. Review `index.md`, `manifest/run.json`, `manifest/tests.jsonl`, and `manifest/findings.jsonl`.
4. Only then make a final statement about regression safety or test correctness.

### Coverage Review Workflow

1. Split command or package audits into scoped groups.
2. Give each group its own expectations file and temp output directory.
3. Run each group with `allure run`.
4. Review runtime artifacts first, then inspect source code only after the run explains what actually executed.
5. Mark the review incomplete until each scoped group either matched expectations or was explicitly documented as a broad package-health audit.

## Per-Run Artifacts

- `ALLURE_AGENT_OUTPUT` must use a unique temp directory per run.
- `ALLURE_AGENT_EXPECTATIONS` must use a unique temp file per run.
- Do not reuse those paths across parallel runs.

YAML is preferred for expectations in v1.

Review-oriented expectations example:

```yaml
goal: Review module tests
task_id: module-review
expected:
  label_values:
    module: my-module
notes:
  - Review runtime evidence before source inspection.
```

Broad package-health audits may omit expectations, but the resulting scope review is weaker and should be called out explicitly.

Compact coverage-review pattern:

```bash
TMP_DIR="$(mktemp -d)"
EXPECTATIONS="$TMP_DIR/expectations.yaml"

ALLURE_AGENT_OUTPUT="$TMP_DIR/agent-output" \
ALLURE_AGENT_EXPECTATIONS="$EXPECTATIONS" \
npx allure run -- npm test -- <scope>
```

Single-spec expectations example:

```yaml
goal: Review one spec
task_id: single-spec-review
expected:
  label_values:
    package: path/to/spec.test.ts
notes:
  - Review runtime evidence before source inspection.
```

## Evidence Rules

- Steps must wrap real setup, actions, state transitions, or assertions.
- Attachments must contain real runtime evidence from that execution.
- Metadata should stay minimal and purposeful.
- Prefer helper-boundary instrumentation over repetitive caller wrapping.

Good example:

- instrument `runCommand` once instead of wrapping every `runCommand(...)` caller

Rejected examples:

- empty wrapper steps
- static `test passed` attachments
- labels that no review or policy step uses

## When Console Errors Are Not Represented As Test Results

- Suite-load, import, or setup failures may appear only in `artifacts/global/stderr.txt` or global errors.
- If `manifest/tests.jsonl` does not account for all visible failures from the test runner, inspect global stderr before concluding the run is fully modeled.
- Treat that state as a partial runtime review, not as a clean or complete result set.
- If runner-visible failures are present outside logical test files, final conclusions must stay provisional until the missing modeling is understood.

## Acceptance Rules

Accept a run only when:

- scope matches expectations
- evidence is strong enough to explain what happened
- no high-confidence noop or placeholder findings remain

### Review Completeness

A test review is not complete unless:

- the relevant scope was run with agent mode, unless that is impossible
- expectations were created for the intended scope, unless this is a broad package-health audit
- agent artifacts were reviewed before final conclusions
- missing or partial runtime modeling was called out explicitly
- console-only conclusions are treated as provisional when agent output is absent or incomplete

## Future Loops

Planned separately:

- flaky detection/fix
- known-issue and mute handling
- quality-gate adoption
