# Agent Plugin

[<img src="https://allurereport.org/public/img/allure-report.svg" height="85px" alt="Allure Report logo" align="right" />](https://allurereport.org "Allure Report")

- Learn more about Allure Report at https://allurereport.org
- 📚 [Documentation](https://allurereport.org/docs/) – discover official documentation for Allure Report
- ❓ [Questions and Support](https://github.com/orgs/allure-framework/discussions/categories/questions-support) – get help from the team and community
- 📢 [Official announcements](https://github.com/orgs/allure-framework/discussions/categories/announcements) – be in touch with the latest updates
- 💬 [General Discussion ](https://github.com/orgs/allure-framework/discussions/categories/general-discussion) – engage in casual conversations, share insights and ideas with the community

---

## Overview

This plugin writes AI-friendly markdown summaries for a test run. It is designed for
flows like:

```shell
npx allure agent -- npm test
```

When enabled, the plugin writes:

- `index.md` with run summary, advisory findings, expected-scope overview, and links to every logical test
- `manifest/test-events.jsonl` as the append-only live event stream while the run is active
- one markdown file per logical test under `tests/<environment>/<historyId-or-trId>.md`
- `manifest/run.json`, `manifest/tests.jsonl`, and `manifest/findings.jsonl` for machine-readable review
- copied run logs and other artifacts under `artifacts/`
- `AGENTS.md` with guidance for consuming the directory
- `manifest/expected.json` when inline flags, `--expectations <file>`, or plugin options provide expectations

If no output directory is configured, the plugin does nothing.

The plugin stays read-only by design. A separate harness layer can consume the
generated manifests, plan enrichment work, and decide whether a rerun is ready to
accept.

## Verification Standard

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.
- Use `allure agent` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.

## CLI Capability Workflow

The installed CLI help is the local contract for agent mode. When an agent needs
to choose supported commands or flags, detect the local CLI surface first:

```shell
allure --version
allure agent capabilities --json
allure agent --help
allure agent query --help
allure agent select --help
allure agent latest --help
allure agent state-dir --help
```

`allure agent capabilities --json` is the structured local contract for agents.
`allure agent --help` includes the human-readable command task map. Each
agent-mode command names the loop it supports, the problem signal that calls for
it, and the task the agent should perform with it. For example, `allure agent
latest` belongs to output recovery, `allure agent state-dir` belongs to tooling
diagnosis, `allure agent query` belongs to output inspection,
`allure agent select` belongs to rerun planning, and `--rerun-*` belongs to
focused retry loops.

Every generated run includes an `AGENTS.md` playbook with the same stable
artifact-reading order, command task map, workflow guidance, and remediation
rules. Reusable skills and common knowledge files should not hard-code
version-specific flags; they should ask the local CLI when support is unclear.

## Install

Use your favorite package manager to install the package:

```shell
npm add @allurereport/plugin-agent
yarn add @allurereport/plugin-agent
pnpm add @allurereport/plugin-agent
```

Then, add the plugin to the Allure configuration file:

```diff
import { defineConfig } from "allure";

export default defineConfig({
  name: "Allure Report",
  output: "./allure-report",
  plugins: {
+    agent: {
+      options: {
+        outputDir: "./out/agent-report",
+      },
+    },
  },
});
```

The preferred CLI entrypoint is:

```shell
npx allure agent -- npm test
```

To analyze existing Allure results or dump archives downloaded from CI without
rerunning tests, use `agent inspect`. Positional arguments match Allure results
directories. `--dump` accepts paths or glob patterns and can be repeated for
multiple jobs or environments:

```shell
npx allure agent inspect path/to/allure-results
npx allure agent inspect --dump allure-results-linux.zip --dump allure-results-macos.zip
npx allure agent inspect --config ./allurerc.mjs --output ./agent-output path/to/allure-results
```

`agent inspect` accepts the same result inputs and configuration-style options as
`allure generate`, including result directory globs, `--dump`, `--config`,
`--cwd`, `--report-name`, `--history-limit`, and `--hide-labels`. Its `--output`
option writes the agentic output directory.

`allure agent` and `allure agent inspect` use `--report auto` by default. This
writes the agent-readable artifacts and, when the stored visible result count is
1000 or fewer, also writes a single-file Awesome report at `awesome/index.html`
inside the agent output directory. Runs above that threshold skip the human
report to avoid excessive output. Check `manifest/human-report.json`, the Human
Report section in `index.md`, or `allure agent query --latest summary` to see
whether a report was generated.

If you need the human-readable report from the most recent agent run, first run
`npx allure agent latest` when the output directory is unknown. Then check
`<output>/manifest/human-report.json`; when its status is `generated`, open
`<output>/<path>` from that manifest, usually `<output>/awesome/index.html`.
Use `--report off` for agent-only artifacts, `--report awesome` to force the
single-file Awesome report regardless of result count, or `--report config` to
force the configured non-agent report plugins inside the agent output directory.

You can provide compact inline expectations for the common review path:

```shell
npx allure agent \
	  --goal "Review feature A" \
	  --expect-tests 3 \
	  --expect-label feature=feature-a \
	  --expect-step-containing "validate feature A" \
	  --expect-steps 1 \
	  -- npm test
```

Use an explicit expectations file and output directory when inline flags become awkward or you need deterministic paths:

```shell
npx allure agent \
  --output ./out/agent-report \
  --expectations ./out/agent-expected.yaml \
  -- npm test
```

That command uses the default `--report auto` policy. Configured presentation or
export plugins such as Dashboard or TestOps are otherwise ignored for agent runs
unless you explicitly use `--report config`.

## Options

The plugin accepts the following options:

| Option | Description | Type | Default |
|--------|-------------|------|---------|
| `outputDir` | Directory where the markdown report will be written. Relative paths are resolved from the `allure` process working directory | `string` | none |
| `expectationsPath` | Path to a YAML or JSON file describing expected and forbidden test scope | `string` | none |
| `expectations` | Inline expectations object. Use either `expectationsPath` or `expectations`, not both | `AgentExpectationsInput` | none |
| `command` | Executed command string recorded in `manifest/run.json` and `index.md` | `string` | none |
| `agentName` | Optional agent identifier recorded in `manifest/run.json` | `string` | none |
| `loopId` | Optional loop identifier recorded in `manifest/run.json` | `string` | none |
| `taskId` | Optional task identifier recorded in `manifest/run.json` | `string` | expectations task id |
| `conversationId` | Optional conversation identifier recorded in `manifest/run.json` | `string` | none |

## Manifest Contract

The plugin emits a hybrid output:

- Markdown for direct review:
  - `index.md`
  - `tests/<environment>/<slug>.md`
  - `AGENTS.md`
- Machine-readable manifests for agents and tooling:
  - `manifest/run.json`
  - `manifest/test-events.jsonl`
  - `manifest/tests.jsonl`
  - `manifest/findings.jsonl`
  - `manifest/expected.json` when expectations are provided

`index.md` is the landing page for the run. It includes run identity, expected scope,
advisory check summary, process logs, and grouped test links.

Each test markdown file includes:

- test identity and metadata
- expectation comparison
- copied attachment links
- retry history
- advisory findings and rerun guidance when evidence is weak

## Expectations

The preferred `allure agent` workflow uses inline flags:

- `--goal <text>` records the review intent.
- `--expect-tests <count>` checks visible logical test count.
- `--expect-label name=value`, `--expect-env <id>`, `--expect-test "<fullName>"`, and `--expect-prefix <prefix>` define expected scope. For a newly added test, use `--expect-test "<fullName>"` so a missing reported test becomes an explicit finding.
- `--expect-step-containing <text>`, `--expect-steps <count>`, `--expect-attachments <count>`, and `--expect-attachment <name|name=value|content-type=value>` define evidence expectations per evidence-target logical test.

The plugin normalizes inline expectations into `manifest/expected.json`.

## Expectations File

When `--expectations <file>` or the plugin `expectationsPath` option is set, the plugin accepts YAML or JSON, normalizes it into `manifest/expected.json`, and compares the run against it.

Expected top-level fields:

```yaml
goal: Validate feature A
task_id: feature-a
expected:
  test_count: 3
  environments:
    - default
  full_names:
    - suite feature A should work
  full_name_prefixes:
    - suite feature A
  label_values:
    feature: feature-a
forbidden:
  full_names:
    - suite feature B should not run
  full_name_prefixes:
    - suite feature B
  label_values:
    feature:
      - feature-b
      - legacy-feature
notes:
  - Only feature A tests should run.
```

Selectors are advisory. The plugin does not fail the run; it records findings in
markdown and `manifest/findings.jsonl`.

## Agent Workflow Pattern

Use the smallest workflow that matches the task. For the common change-validation path:

1. Run tests with `allure agent --goal <text> --expect-test "<fullName>" --expect-label name=value --expect-step-containing <text> -- <command>`.
2. Watch `manifest/run.json` and `manifest/test-events.jsonl` while the run is active.
3. Review `index.md` plus the manifest files.
4. If evidence is weak, add steps, attachments, labels, or parameters.
5. Rerun the same scope with the same expectations.
6. Accept the run or iterate based on advisory findings.

When a prior agent run already captured failed tests, prefer
`allure agent --rerun-latest --rerun-preset failed -- <command>` or
`allure agent --rerun-from <output-dir> --rerun-preset failed -- <command>`
instead of spending context reconstructing runner-specific test names.

For small mechanical test changes, use a scoped agent-mode run for the smoke check
too. Plain runner commands should be reserved for cases where agent mode is
impossible or when you are debugging agent mode itself.

For grouped coverage reviews, prefer one scoped expectation set per group instead of trying to review a whole command matrix from a single run.

## Test Enrichment Best Practices

Use agent mode to improve evidence quality, not to decorate tests with generic noise.

- Steps must wrap real actions, state transitions, or assertions.
- Attachments must contain real runtime artifacts from that execution.
- Metadata should stay minimal and purposeful. Add labels or severity only when
  expectations, debugging, or downstream quality policy actually uses them.
- Instrument stable helpers when several call sites need the same evidence.
  For example, teach `runCommand` to emit a step instead of wrapping every
  `runCommand(...)` call site with identical step blocks.

Avoid dummy enrichment:

- no empty wrapper steps
- no placeholder `"passed"` or `"success"` attachments
- no labels or taxonomy that never participates in scope review or policy

Acceptance should stay strict even though the plugin itself is advisory:

- regenerate expectations before each targeted rerun
- rerun only the intended tests when possible
- reject the rerun when scope drifts or high-confidence noop-style findings remain
- iterate again when evidence is still too weak to explain what happened

When agent output does not fully model runner-visible failures:

- inspect `artifacts/global/stderr.txt` and global errors before concluding the run is complete
- treat the review as partial when suite-load, import, or setup failures are visible outside logical test files
- keep console-only conclusions provisional until the missing modeling is understood

## Copyable Agent Instructions

The generated `AGENTS.md` already contains this guidance for each run. If you want
the same stable policy in a reusable skill or agent prompt, keep version-specific
CLI details out of that reusable body and make agents inspect local CLI help when
support is unclear:

```md
## Allure Agent Mode Instructions

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.
- Use `allure agent` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.
- After each agent-mode test run, print the `index.md` path from that run's output directory so users can open the run overview quickly.
- Use `allure --version`, `allure agent capabilities --json`, and `allure agent --help` before choosing flags when the local CLI surface is unknown.
- Use `allure agent latest` to print the newest output directory and `index.md` path when `--output` was omitted.
- Use `allure agent latest`, `state-dir`, `query`, `select`, and `--rerun-*` according to their loop/task/problem mapping instead of treating them as interchangeable helper commands.
- Use `allure agent inspect <allure-results-dir-or-glob>` or `allure agent inspect --dump <archive-or-glob>` when you need agent-readable markdown and manifests from existing Allure results without rerunning tests locally; repeat `--dump` for multiple CI jobs or environments.
- Use `allure agent query --latest summary|tests|findings|test` or `allure agent query --from <output-dir> ...` to inspect prior output as focused JSON before manually opening raw manifests.
- Use `allure agent select --from <output-dir> --output <file>` when you want the CLI to write the test plan and print a short summary with the file path, source output, preset, and selected count.
- When rerunning previous failures, use `allure agent --rerun-latest --rerun-preset failed -- <command>` or `allure agent --rerun-from <output-dir> --rerun-preset failed -- <command>` instead of manually rebuilding runner-specific test names.
- Run tests with `allure agent` and review `manifest/run.json`, `manifest/test-events.jsonl`, `index.md`, `manifest/tests.jsonl`, and `manifest/findings.jsonl`.
- Enrich only the intended tests. Add real steps for real setup, actions, and assertions.
- Attach only real runtime evidence such as payloads, responses, screenshots, DOM snapshots, diffs, logs, or traces.
- Keep metadata minimal. Add labels or severity only when scope review, debugging, or quality policy uses them.
- Instrument stable helpers when several call sites need the same evidence. For example, teach `runCommand` to emit a step instead of wrapping every caller.
- Reject the rerun if scope drifts, evidence stays weak, or high-confidence noop-style findings remain.
```

## Harness API

The package also exports a small read-only harness API for agent workflows:

```ts
import {
  buildAgentExpectations,
  loadAgentOutput,
  planAgentEnrichmentReview,
  reviewAgentOutput,
} from "@allurereport/plugin-agent";
```

- `buildAgentExpectations(...)` converts a goal plus target/forbidden selectors into
  the expectations shape accepted by inline flags, expectations files, and the plugin expectations option.
- `loadAgentOutput(...)` reads `manifest/run.json`, `manifest/tests.jsonl`, and
  `manifest/findings.jsonl`.
- `planAgentEnrichmentReview(...)` maps `check_name` values to enrichment actions
  and returns an acceptance decision.
- `reviewAgentOutput(...)` is the convenience wrapper that loads and reviews in one call.

The harness does not mutate tests. It tells an agent what to fix next and rejects
acceptance when scope drifts or high-confidence noop-style evidence remains.

## Enrichment Policy

The enrichment loop should add only real runtime evidence:

- Steps must wrap real actions, state transitions, or assertions.
- Attachments must contain runtime data produced by that execution.
- Feature/task labels are required only when they are used for scope review.
- Severity should be added only when it matters for review or quality-gate policy.

Avoid dummy enrichment such as empty wrapper steps, placeholder `"passed"` text
attachments, or labels that are never used downstream.

For remediation mapping and JS/Vitest examples based on the existing sandbox
tests, inspect the package tests and generated run `AGENTS.md` guidance.
