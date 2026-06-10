# Allure Test Agent

Use Allure agent mode to design, review, validate, debug, and enrich tests in this project.

This file is project-specific guidance. Durable test-design, expectation, and evidence rules live in the `allure-test-agent` skill. If the skill is available, use it together with this file. If the skill is unavailable, follow this file as the local fallback and keep conclusions conservative.

## Review Principle

Runtime first, source second.

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through the local agent test service when available, or through `allure agent` otherwise.
- Use agent-mode execution for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when debugging agent mode itself.
- If agent-mode output is missing or incomplete, debug that first and treat console-only conclusions as provisional.

## Local Capability Snapshot

Refresh this section when Allure, test runners, CI, or project wrappers change. Confirm local support with the project wrapper, `allure --version`, and `allure agent --help` before using optional commands.

Do not store the exact Allure version here. Version output is a runtime fact; this file stores the wrapper, last snapshot marker, and how to refresh capabilities.

- Allure wrapper: `yarn allure`
- Capability snapshot last checked: `2026-06-10`
- Refresh capabilities with: `yarn allure --version`, `yarn allure agent capabilities --json`, and `yarn allure agent --help`
- Agent execution: supported with `yarn allure agent -- <command>`
- Output option: `--output <dir>` or `-o <dir>`; omitted output uses a fresh temporary directory
- Expectation controls: `--goal`, `--task-id`, `--expect-tests`, `--expect-test`, `--expect-prefix`, `--expect-label`, `--expect-env`, `--forbid-label`, `--expect-step-containing`, `--expect-steps`, `--expect-attachments`, `--expect-attachment`, and advanced `--expectations <yaml|json>`
- Latest/state directory recovery: `yarn allure agent latest`; `yarn allure agent state-dir`; `ALLURE_AGENT_STATE_DIR=<dir>` override
- Selection/rerun support: `yarn allure agent select --latest|--from <dir>` and `yarn allure agent --rerun-latest|--rerun-from <dir> -- <command>`
- Discovery/configuration commands: unsupported by this local CLI
- Local agent test service: unsupported or unknown; use `yarn allure agent` directly

## Local Agent Test Service

Use the local agent test service when the project provides one and the task is query-heavy, stateful, or iterative. Use `allure agent` directly when service mode is unavailable or unnecessary.

- Service status: unsupported or unknown
- Start or connect command: unknown
- Capability/status endpoint: unknown
- Supported intents: use direct CLI runs, query, select, and rerun commands
- Supported profiles and selectors: direct runner selectors plus agent expectation flags
- Query support: `yarn allure agent query --latest summary|tests|findings|test` or `--from <output-dir>`
- Realtime and cancellation support: unknown for service mode
- Service logs or diagnostics: unknown
- Fallback when unavailable: `yarn allure agent -- <command>`

## Local Test Surfaces

- Test frameworks and runners: Yarn workspaces; Vitest for most packages; Playwright for `@allurereport/e2e` and `@allurereport/static-server`
- Test roots: package-local tests under `packages/*/test`, Playwright tests in `packages/e2e` and `packages/static-server`, plus package-specific config files
- Allure result paths: most Vitest packages write `./out/allure-results`; `packages/sandbox` writes `./allure-results`; Playwright packages write `./out/allure-results`
- Known selector support: Vitest file/name selectors, Playwright file/project selectors, workspace package selection through `yarn workspace <name>`
- Known environments or services needed for tests: Playwright browser dependencies for e2e/static-server; CI runs OS matrix environments

## Allure Integrations

Document only integrations detected or explicitly configured in this project.

- Existing Allure adapters/integrations: `allure-vitest`, `allure-playwright`, Allure CLI `run`, `agent`, `generate`, and report plugins
- Runner config files: root `allurerc.mjs`; package `vitest.config.ts`; `packages/e2e/playwright.config.ts`; `packages/static-server/playwright.config.ts`
- Allure results directories: package `out/allure-results`, sandbox `allure-results`, CI dumps `allure-results-<os>.zip`
- Supported integration configuration targets: discovered package runner configs
- Validation command for integration setup: focused package command through `yarn allure agent -- yarn workspace <name> test`
- Known unsupported or skipped integrations: local agent service, discovery/configuration commands
- Integration-specific quirks: many package tests clean `./out`; CI uses `yarn allure run --config=./allurerc.gate.mjs --environment=<os> --dump=allure-results-<os> -- yarn test`

## Project Test-Design Conventions

Fill only conventions that exist in this project. Durable test-design rules stay in the `allure-test-agent` skill.

- Accepted test layers: unit/package tests with Vitest; browser/e2e tests with Playwright; CLI integration tests in `packages/cli`
- Preferred assertion style: framework matchers and focused assertions from existing package tests
- Parameterized test style: use existing Vitest/Playwright conventions in the touched package
- Smoke coverage conventions: use focused package or file-level runs for small changes; root `yarn test` is broad package health
- Mocking and integration-test preference: follow the touched package's existing test style
- Suppression/quarantine policy: unknown; do not present skipped or non-gating tests as proof

## Run Profiles

Document only profiles that exist in this project. If a profile is inferred rather than confirmed, mark it as inferred.

| Profile | Command or service intent | Expected use | Confidence limits |
| --- | --- | --- | --- |
| smoke | `yarn allure agent -- yarn workspace <name> test <file-or-pattern>` when the runner supports narrowing | Quick signal for a touched package or test file | Does not prove downstream package behavior |
| affected | `yarn allure agent -- yarn workspace <name> test` plus changed package build | Package-level validation after local edits | Mapping may miss indirect workspace impact |
| feature/component | `yarn allure agent --goal <text> --expect-* -- yarn workspace <name> test <selector>` | Focused validation for one behavior or component | Depends on runner selector precision |
| full | `yarn allure agent -- yarn test` | Broad workspace test signal | Cost may be high and process-tree tests may be environment-sensitive |
| e2e | `yarn allure agent -- yarn workspace @allurereport/e2e test` or static-server e2e command | Browser workflow validation | Requires installed Playwright browsers/dependencies |

## Execution Signal And CI Trust

Do not present ignored, excluded, swallowed, advisory, or non-gating test execution as proof that behavior is safe.

- Default local test command: `yarn test`
- Default local command exclusions: root `yarn test` excludes `packages/sandbox`
- CI test jobs: `.github/workflows/build.yml` job `test` runs across OS matrix
- CI gating status: branch protection unknown; workflow test job appears intended as a primary validation signal
- Known ignored, skipped, muted, quarantined, or disabled tests: package-specific and runtime-dependent; inspect run output before claiming proof
- Test artifacts retained by CI: `allure-results-<os>.zip` dumps are uploaded and later used for report generation

If CI or local execution is non-gating, excludes important tests, or swallows failures, call that out before using the run as proof.

## Local Expectation Controls

Before each validation run, decide whether expectations reduce a real risk for the intended conclusion. When they do, use the smallest fresh inline options supported by local `allure agent --help`.

- Supported expectation mechanism: inline CLI options and advanced YAML/JSON file mode
- Exact test/file/suite/label/profile support: exact logical full name with `--expect-test`; full-name prefix with `--expect-prefix`; label with `--expect-label name=value`; environment with `--expect-env`
- Excluded-scope controls: `--forbid-label name=value`
- Evidence expectation controls: `--expect-step-containing <text>`, `--expect-steps <count>`, `--expect-attachments <count>`, `--expect-attachment <name|name=value|content-type=value>`
- Check/assertion step-name controls: use `--expect-step-containing <text>` when the project records checks as test-scoped Allure steps
- Broad-audit fallback: run the narrowest practical command, then inspect `manifest/tests.jsonl` and `manifest/findings.jsonl` before claiming scope

Prefer inline options. Use `--expectations <file>` only as advanced mode when the contract is too large, generated, or policy-controlled.

When expectations are justified, they should state only the parts that matter for this run:

- what claim or validation depth the run is meant to support
- what should run
- what should not run
- which profile, environment, variant, or parameter set is intended
- what important checks or evidence should be visible through supported reporting or documented step-name conventions
- why this scope is enough
- what the run cannot prove

If local expectation support is unavailable or weak, run the narrowest practical command, review observed scope from manifests, and state that expectation checking was limited.

Treat the run goal as a claim boundary for review, not as proof. If the goal is wrong or stale, keep the runtime evidence and report what the observed run actually supports.

## Core Loops

### Test Review Loop

1. Identify the exact review scope and validation depth.
2. Create the smallest meaningful expectations using local supported controls when they protect the review conclusion.
3. Run only that scope through the local agent test service or `allure agent`.
4. Print the run's `index.md` path.
5. Review `index.md`, `manifest/run.json`, `manifest/test-events.jsonl`, `manifest/tests.jsonl`, `manifest/findings.jsonl`, and relevant per-test markdown.
6. Inspect source code only after runtime evidence explains what executed.
7. Call out weak scope, weak evidence, execution-signal limits, or partial runtime modeling.

### Test Authoring Loop

1. Understand the feature, issue, expected behavior, and risk.
2. Read the `allure-test-agent` skill's test-design guidance when available.
3. Create the smallest meaningful expectations for the intended scope when they reduce a real validation risk.
4. Write or update focused tests without weakening useful coverage.
5. Run the intended scope through agent mode.
6. Review scope, checks, evidence, and execution signal before claiming validation.
7. Enrich tests when evidence is weak, then rerun with fresh temp output.

### Evidence And Metadata Enrichment Loop

Use this when tests pass but are hard to review:

1. Identify weak evidence, missing checks, missing setup state, missing artifacts, or noisy metadata.
2. Prefer framework integrations and helper-boundary instrumentation over wrapping every line.
3. Add useful steps, attachments, parameters, descriptions, labels, or links using project conventions.
4. Redact sensitive values while preserving useful artifact shape.
5. Rerun the same intended scope and report evidence changes.

### Coverage Review Loop

1. Split broad audits into scoped groups when practical.
2. Give each group a unique temp output directory and use expectations only when the group has a known scope or supports a validation conclusion.
3. Run each group through agent mode.
4. Separate observed runtime coverage from inferred source-code coverage.
5. Mark review incomplete until every scoped group was validated through matched expectations, reviewed observed scope, or documented as a broad package-health audit.

## Runtime Artifact Review

After each agent-mode run:

- print the run's `index.md` path
- read `manifest/run.json`
- read `manifest/test-events.jsonl`
- read `manifest/tests.jsonl`
- read `manifest/findings.jsonl`
- read relevant per-test markdown before inspecting source
- inspect global stderr/log artifacts when runner-visible failures are not represented as logical tests

## Output, State, And Reruns

Do not create persistent output or expectation paths. Use unique temp paths for every run.

- Agent output policy: use omitted output for fresh temp output or an explicit unique temp dir; do not reuse output directories across runs
- Latest output recovery: `yarn allure agent latest`
- State directory override: `ALLURE_AGENT_STATE_DIR=<dir>`
- Rerun from latest/prior output: `yarn allure agent --rerun-latest -- <command>` or `yarn allure agent --rerun-from <output-dir> -- <command>`
- Selection/test plan support: `yarn allure agent select --latest` or `--from <output-dir>` with `--preset review|failed|unsuccessful|all`
- Parallel-run rule: output paths and expectation state must not be shared
- CI artifact retention: CI uploads Allure result dumps, not agent output directories unless a job is changed to do so

## Project Metadata Conventions

Fill only conventions that exist in this project.

- Feature/story/component/service labels: existing tests commonly use Allure `epic`, `feature`, `story`, and `label`; package configs often set `module=<package>`
- Owner/team metadata: unknown
- Severity or priority metadata: use only when already present or meaningful for review/policy
- Issue, bug, requirement, or known-defect links: unknown
- Suite/package/module taxonomy: package-level `module` labels from Vitest config are common
- Parameter naming and dynamic-history exclusions: follow existing package examples
- Metadata to avoid: decorative labels or unused taxonomy that does not help selection, triage, or review

## Project Evidence Conventions

Fill only conventions that exist in this project.

- Test descriptions: follow existing package style
- Attachments: command output, manifests, text/JSON artifacts, screenshots/traces where relevant
- Step naming: use specific action/check names rather than generic wrappers
- Check/assertion step naming: use meaningful text that can be matched with `--expect-step-containing` when review requires visible checks
- Assertion/check visibility: prefer real test-scoped steps and useful attachments around behavior, not placeholder evidence
- Fixture/setup evidence: include only when it explains the behavior or failure
- Sensitive data redaction: redact secrets and tokens while preserving useful artifact shape

## Acceptance Rules

Accept a run only when:

- observed scope matches the intended scope, or drift is explained
- coverage remains meaningful for the stated conclusion
- important checks are visible through supported reporting, documented step-name conventions, or source review covers the gap
- evidence is strong enough to explain what happened
- execution-signal limits are explicit
- no high-confidence placeholder or noop evidence findings remain
- partial runtime modeling is called out

Console-only conclusions are provisional when agent output is absent or incomplete.
