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
- `manifest/expected.json` when `ALLURE_AGENT_EXPECTATIONS` is provided
- `project/docs/allure-agent-mode.md` when the project has a guide at `docs/allure-agent-mode.md`

If no output directory is configured, the plugin does nothing.

The plugin stays read-only by design. A separate harness layer can consume the
generated manifests, plan enrichment work, and decide whether a rerun is ready to
accept. See [the enrichment loop guide](../../docs/agent_enrichment_loop.md).

## Verification Standard

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.
- Use `allure agent` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.

## Skills-First Workflow

The downstream workflow is intended to be skills-first:

1. install the Allure skills bundle
2. run the setup skill in a project
3. let the setup skill create or update root `AGENTS.md`
4. let the setup skill create `docs/allure-agent-mode.md`
5. use Allure agent-mode in future test work through the project guide plus per-run manifests

Every generated run includes an `AGENTS.md` playbook. When the project has
`docs/allure-agent-mode.md`, the run output also copies that guide and tells agents
to read it first.

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

You can provide an explicit expectations file and output directory when you need deterministic paths:

```shell
npx allure agent \
  --output ./out/agent-report \
  --expectations ./out/agent-expected.yaml \
  -- npm test
```

That command uses an agent-only profile by default, so configured presentation and export plugins such as Awesome, Dashboard, or TestOps are ignored for that run.

You can also enable the plugin through lower-level environment variables when you need direct env control:

```shell
ALLURE_AGENT_OUTPUT=./out/agent-report npx allure run -- npm test
```

To compare the run against an intended scope, provide an expectations file:

```shell
ALLURE_AGENT_OUTPUT=./out/agent-report \
ALLURE_AGENT_EXPECTATIONS=./out/agent-expected.yaml \
npx allure run -- npm test
```

## Options

The plugin accepts the following options:

| Option | Description | Type | Default |
|--------|-------------|------|---------|
| `outputDir` | Directory where the markdown report will be written. Relative paths are resolved from the `allure` process working directory | `string` | `ALLURE_AGENT_OUTPUT` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ALLURE_AGENT_OUTPUT` | Directory where the agent output should be written when `outputDir` is not set |
| `ALLURE_AGENT_EXPECTATIONS` | Optional path to a YAML or JSON file describing expected and forbidden test scope |
| `ALLURE_AGENT_COMMAND` | The executed command string recorded in `manifest/run.json` and `index.md` |
| `ALLURE_AGENT_NAME` | Optional agent identifier recorded in `manifest/run.json` |
| `ALLURE_AGENT_LOOP_ID` | Optional loop identifier recorded in `manifest/run.json` |
| `ALLURE_AGENT_TASK_ID` | Optional task identifier recorded in `manifest/run.json` |
| `ALLURE_AGENT_CONVERSATION_ID` | Optional conversation identifier recorded in `manifest/run.json` |

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
  - `manifest/expected.json` when an expectations file is provided
  - `project/docs/allure-agent-mode.md` when the project guide is available

`index.md` is the landing page for the run. It includes run identity, expected scope,
advisory check summary, process logs, and grouped test links.

Each test markdown file includes:

- test identity and metadata
- expectation comparison
- copied attachment links
- retry history
- advisory findings and rerun guidance when evidence is weak

## Expectations File

When `ALLURE_AGENT_EXPECTATIONS` is set, the plugin accepts YAML or JSON, normalizes
it into `manifest/expected.json`, and compares the run against it.

Expected top-level fields:

```yaml
goal: Validate feature A
task_id: feature-a
expected:
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

## Review Loop

The intended usage pattern is:

1. Run tests with `allure agent -- <command>`.
2. Watch `manifest/run.json` and `manifest/test-events.jsonl` while the run is active.
3. Review `index.md` plus the manifest files.
4. If evidence is weak, add steps, attachments, labels, or parameters.
5. Rerun the same scope with the same expectations file.
6. Accept the run or iterate based on advisory findings.

For small mechanical test changes, use a scoped agent-mode run for the smoke check
too. Plain runner commands should be reserved for cases where agent mode is
impossible or when you are debugging agent mode itself.

For grouped coverage reviews, prefer one temp output directory and one expectations
file per scope instead of trying to review a whole command matrix from a single run.

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

## Project Guide

Projects using the skills flow should keep a short root `AGENTS.md` and a deeper
`docs/allure-agent-mode.md`.

`AGENTS.md` should route all test-related work to the deeper guide. The deeper guide
should explain:

- the feature-delivery loop
- the metadata-enrichment loop
- per-run temp expectations and output paths
- meaningful evidence rules
- minimal metadata rules
- future loops like flaky, known-issue, mute, and quality gates

## Copyable Agent Instructions

The generated `AGENTS.md` already contains this guidance for each run. If you want
the same policy in a project-level skill or agent prompt, you can start with:

```md
## Allure Agent Mode Instructions

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.
- Use `allure agent` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.
- After each agent-mode test run, print the `index.md` path from that run's output directory so users can open the run overview quickly.
- Use `allure agent latest` to reopen the newest run when `--output` was omitted.
- Use `allure agent state-dir` to inspect where the current project stores its latest-agent state.
- Use `allure agent select --latest` or `allure agent select --from <output-dir>` to inspect the review-targeted test plan before rerunning.
- Use `allure agent --rerun-latest -- <command>` or `allure agent --rerun-from <output-dir> -- <command>` to rerun only the selected tests.
- Use `--rerun-preset review|failed|unsuccessful|all`, repeated `--rerun-environment <id>`, and repeated `--rerun-label name=value` when you need a narrower rerun selection from the previous output.
- Use `ALLURE_AGENT_STATE_DIR` when you need to override where the current project stores latest-agent state for `latest`, `state-dir`, or `--rerun-latest`.
- Use `ALLURE_AGENT_*` with `allure run` only as the lower-level fallback when you need direct environment control.
- Generate or refresh `ALLURE_AGENT_EXPECTATIONS` before each targeted rerun.
- Run tests with `ALLURE_AGENT_OUTPUT` and review `manifest/run.json`, `manifest/test-events.jsonl`, `index.md`, `manifest/tests.jsonl`, and `manifest/findings.jsonl`.
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
  the JSON shape expected by `ALLURE_AGENT_EXPECTATIONS`.
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

For a fuller policy, remediation mapping, and JS/Vitest examples based on the
existing sandbox tests, see [the enrichment loop guide](../../docs/agent_enrichment_loop.md).
