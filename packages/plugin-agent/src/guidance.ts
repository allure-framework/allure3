export type EnrichmentActionCategory =
  | "bootstrap-allure"
  | "narrow-test-scope"
  | "repair-test-metadata"
  | "add-meaningful-steps"
  | "add-test-attachments"
  | "add-retry-diagnostics"
  | "collapse-low-signal-trace"
  | "review-manually";

export type EnrichmentActionDefinition = {
  category: EnrichmentActionCategory;
  title: string;
  guidance: string;
};

export const ENRICHMENT_ACTIONS_BY_CHECK_NAME: Record<string, EnrichmentActionDefinition> = {
  "expectations-invalid": {
    category: "bootstrap-allure",
    title: "Repair the expectations input",
    guidance: "Regenerate valid inline expectations or a valid YAML/JSON expectations file before the next iteration.",
  },
  "expectations-empty": {
    category: "narrow-test-scope",
    title: "Add recognized expectation controls",
    guidance: "Rerun with supported M1 expectation controls or omit expectations for an intentionally broad review.",
  },
  "expectations-unsupported-control": {
    category: "review-manually",
    title: "Use supported expectation controls",
    guidance: "Replace unsupported controls with supported M1 flags or report weaker checking explicitly.",
  },
  "expectations-weak-goal": {
    category: "review-manually",
    title: "Use a more specific goal next time",
    guidance:
      "Base conclusions on observed evidence and rerun with a specific goal when expectation precision matters.",
  },
  "no-tests-observed": {
    category: "bootstrap-allure",
    title: "Restore Allure result generation",
    guidance: "Make sure the test command emits Allure results before rerunning the enrichment loop.",
  },
  "missing-global-logs": {
    category: "bootstrap-allure",
    title: "Capture bootstrap logs when needed",
    guidance: "Keep stdout and stderr capture enabled when you need run-level debugging context.",
  },
  "runner-failures-outside-logical-results": {
    category: "bootstrap-allure",
    title: "Inspect partial runtime failures before accepting the review",
    guidance:
      "Check global stderr and global errors for suite-load, import, or setup failures that were not rendered as logical tests.",
  },
  "unmodeled-visible-results": {
    category: "review-manually",
    title: "Call out partial runtime modeling",
    guidance:
      "Compare run statistics with the logical test files and document any skipped or non-passed results that were not rendered.",
  },
  "expected-test-missing": {
    category: "narrow-test-scope",
    title: "Bring the intended test back into scope",
    guidance: "Regenerate expectations and rerun only the planned tests or selectors.",
  },
  "expected-count-mismatch": {
    category: "narrow-test-scope",
    title: "Restore the expected visible test count",
    guidance: "Check the command, selectors, and agent modeling before accepting the run.",
  },
  "expected-prefix-missing": {
    category: "narrow-test-scope",
    title: "Restore the intended name-prefix scope",
    guidance: "Check the selector and rerun only the feature slice that should have matched it.",
  },
  "expected-environment-missing": {
    category: "narrow-test-scope",
    title: "Rerun the intended environment",
    guidance: "Constrain the rerun to the expected environment before accepting the result.",
  },
  "expected-label-missing": {
    category: "repair-test-metadata",
    title: "Add the minimal missing scope label",
    guidance: "Only add the labels required by the expectations selector; do not inflate metadata.",
  },
  "unexpected-environment": {
    category: "narrow-test-scope",
    title: "Remove unrelated environments from the rerun",
    guidance: "Tighten the rerun selector so unrelated environments do not appear in agent output.",
  },
  "forbidden-label-observed": {
    category: "narrow-test-scope",
    title: "Stop forbidden labeled tests from running",
    guidance: "Reject the run, narrow the rerun scope, and keep the forbidden label expectation.",
  },
  "forbidden-selector-match": {
    category: "narrow-test-scope",
    title: "Stop forbidden tests from running",
    guidance: "Reject the run, narrow the rerun scope, and keep the forbidden selectors in expectations.",
  },
  "unexpected-test": {
    category: "narrow-test-scope",
    title: "Remove unexpected tests from the rerun",
    guidance: "Rerun only the intended tests or broaden expectations only if the extra test is truly in scope.",
  },
  "metadata-mismatch": {
    category: "repair-test-metadata",
    title: "Repair scope metadata with the minimum required labels",
    guidance: "Add only the labels or parameters needed for expectations, review, or quality gates.",
  },
  "history-id-collision": {
    category: "repair-test-metadata",
    title: "Repair logical test identity",
    guidance: "Use stable, unique history IDs so distinct logical tests do not collapse into one file.",
  },
  "failed-without-useful-steps": {
    category: "add-meaningful-steps",
    title: "Add meaningful setup, action, and assertion steps",
    guidance: "Wrap only real actions, state transitions, and checks in Allure steps before rerunning.",
  },
  "expected-step-containing-missing": {
    category: "add-meaningful-steps",
    title: "Add or correct the expected step text",
    guidance: "Expose the expected runtime check as a test-scoped Allure step, or correct the expectation wording.",
  },
  "insufficient-expected-steps": {
    category: "add-meaningful-steps",
    title: "Add the expected meaningful steps",
    guidance: "Expose real setup, action, state transition, and assertion steps without adding filler.",
  },
  "insufficient-expected-attachments": {
    category: "add-test-attachments",
    title: "Add the expected runtime attachments",
    guidance: "Attach focused runtime evidence such as payloads, logs, screenshots, diffs, or traces.",
  },
  "missing-expected-attachment": {
    category: "add-test-attachments",
    title: "Add the required attachment",
    guidance: "Attach the requested runtime artifact near the relevant action or assertion.",
  },
  "failed-without-attachments": {
    category: "add-test-attachments",
    title: "Attach focused runtime evidence near the failure",
    guidance: "Add real payloads, responses, screenshots, DOM snapshots, diffs, or logs near the failing point.",
  },
  "nontrivial-run-with-empty-trace": {
    category: "add-meaningful-steps",
    title: "Make the execution path observable",
    guidance: "Expose the real setup, action, and verification path with steps or attachments on the next run.",
  },
  "retries-without-new-evidence": {
    category: "add-retry-diagnostics",
    title: "Capture what changes between retries",
    guidance: "Add per-attempt diagnostics so retries show new evidence instead of repeating the same trace.",
  },
  "noop-dominated-steps": {
    category: "collapse-low-signal-trace",
    title: "Replace noop-style steps with real evidence",
    guidance:
      "Keep only steps tied to real actions or checks, and replace bulk event spam with a compact artifact when needed.",
  },
  "step-spam": {
    category: "collapse-low-signal-trace",
    title: "Reduce low-signal step spam",
    guidance:
      "Prefer a smaller set of meaningful steps plus one compact text attachment when the trace is mostly event logs.",
  },
  "global-only-artifacts": {
    category: "add-test-attachments",
    title: "Move evidence closer to the failing test",
    guidance:
      "Use step-scoped or test-scoped attachments near the relevant failing action instead of relying only on global logs.",
  },
  "passed-without-observable-evidence": {
    category: "add-meaningful-steps",
    title: "Make the success path reviewable",
    guidance: "Add a few real verification steps or attachments so the passing test shows what it proved.",
  },
};

export const AGENT_WORKFLOWS_MARKDOWN = `Use the smallest workflow that matches the task. Each workflow has the same shape: when to use it, which agent-mode commands help, and what must be true before you call the task done.

### Validate A Change

Use when code or tests changed and you need a user-facing safety conclusion. For small mechanical changes, use this same workflow with narrower expectations rather than a separate shortcut.

Commands:

- \`allure agent --goal <text> --expect-* -- <command>\`

Done when:

- the expected scope ran and no forbidden scope appeared
- \`index.md\`, \`manifest/run.json\`, \`manifest/tests.jsonl\`, and \`manifest/findings.jsonl\` were reviewed
- the \`index.md\` path was reported
- the changed package build and required static checks passed when this repository guide requires them

### Add Or Update Tests

Use when creating or changing tests for a feature, fix, or behavior gap.

Commands:

- \`allure agent --goal <text> --expect-tests <count> --expect-test "<fullName>" --expect-label name=value --expect-step-containing <text> -- <command>\`

Done when:

- the tests prove the intended behavior rather than only touching the code path
- scope expectations match the intended feature, issue, or package slice
- each expected test has enough steps or attachments for a reviewer to understand what happened
- weak evidence, scope drift, and unexpected-test findings are fixed or explicitly accepted as out of scope

### Review Existing Coverage

Use when auditing a package, command matrix, feature area, or business behavior without necessarily changing tests first.

Commands:

- one scoped \`allure agent --goal <text> --expect-* -- <command>\` run per review group
- \`allure agent inspect --goal <text> --expect-* <allure-results-dir-or-glob>\` or \`--dump <archive-or-glob>\` when the evidence already exists as local results or CI dump artifacts

Done when:

- the audit is split into reviewable groups, or it is explicitly documented as a broad package-health run
- each group has expectations that describe the intended scope
- runtime artifacts are reviewed before source-only coverage conclusions
- uncovered behavior is recorded as follow-up test work instead of being hidden in a broad pass/fail summary

### Review Existing Evidence

Use when CI has already produced dump archives or local Allure results already exist and you need agent-readable review artifacts without rerunning tests locally.

Commands:

- \`allure agent inspect <allure-results-dir-or-glob>\`
- \`allure agent inspect --dump <archive-or-glob>\`
- \`allure agent inspect --dump <linux.zip> --dump <macos.zip>\`
- \`allure agent inspect --goal <text> --expect-* --dump <archive-or-glob>\`

Done when:

- all intended result directories or dump artifacts were downloaded or present and matched by the command
- \`index.md\`, \`manifest/run.json\`, \`manifest/tests.jsonl\`, and \`manifest/findings.jsonl\` were reviewed
- the review calls out that inspect-derived output cannot add missing live process logs or rerun-time evidence unless those artifacts were captured in the results or dumps
- any environment-specific gaps between CI jobs are explicit

### Triage Failures

Use when tests failed, broke, or runner output does not match agent artifacts.

Commands:

- \`allure agent latest\`
- \`allure agent --rerun-latest --rerun-preset failed -- <command>\`
- \`allure agent --rerun-from <output-dir> --rerun-preset failed -- <command>\`

Done when:

- failing, broken, or unmodeled runner-visible failures are represented in agent artifacts, or partial modeling is called out explicitly
- \`artifacts/global/stderr.txt\` and global errors were checked when failures are missing from \`manifest/tests.jsonl\`
- reruns use prior agent output instead of hand-built runner test names whenever the runner can consume the generated test plan

### Rerun A Prior Scope

Use when prior agent output already identifies failed, unsuccessful, or review-targeted tests and the next run should stay focused.

Commands:

- \`allure agent select --latest [--preset review|failed|unsuccessful|all]\`
- \`allure agent select --from <output-dir> [--environment <id>] [--label name=value]\`
- \`allure agent --rerun-latest -- <command>\`
- \`allure agent --rerun-from <output-dir> -- <command>\`

Done when:

- the rerun scope comes from Allure testplan support
- \`--rerun-preset\`, \`--rerun-environment\`, or \`--rerun-label\` filters explain any narrowed selection
- manual test names are used only as a fallback when testplan support is unavailable
- the rerun output is reviewed before making a new conclusion

### Improve Evidence Quality

Use when tests pass or fail but the runtime story is too weak to review.

Commands:

- \`allure agent --expect-step-containing <text> --expect-steps <count> --expect-attachments <count> -- <command>\`
- \`allure agent --expect-attachment <name|name=value|content-type=value> -- <command>\`

Done when:

- steps describe real setup, actions, state transitions, or assertions
- attachments contain runtime evidence such as payloads, responses, screenshots, DOM snapshots, diffs, logs, or traces
- placeholder steps, generic \`"passed"\` attachments, and other dummy evidence are removed
- the same intended scope was rerun and no high-confidence evidence findings remain

### Recover Or Diagnose Agent Mode

Use when agent output is missing, the latest run cannot be found, local CLI support is unclear, or state behaves differently in CI or a sandbox.

Commands:

- \`allure --version\`
- \`allure agent capabilities --json\`
- \`allure agent --help\`
- \`allure agent latest\`
- \`allure agent state-dir\`
- \`ALLURE_AGENT_STATE_DIR=<dir>\`

Done when:

- supported local commands and flags are known from capabilities or help output
- the output directory, \`index.md\` path, or state directory is identified, or the reason it is unavailable is documented
- console-only conclusions stay provisional until agent-mode artifacts are available`;

export const AGENT_COMMAND_TASK_MAP = [
  "`allure --version`, `allure agent capabilities --json`, and `allure agent --help`: setup and capability-detection loop. Use when the local CLI surface is unknown, generated guidance may be stale, or you need to choose supported flags without guessing.",
  "`allure agent --goal ... -- <command>`: test review, feature delivery, smoke-check, and coverage loops. Use when a test command needs runtime evidence, scope expectations, and user-facing conclusions based on agent artifacts rather than console output alone.",
  "`allure agent inspect <allure-results-dir-or-glob>` / `allure agent inspect --dump <archive-or-glob>`: existing evidence review loop. Use after downloading one or more dump archives or when Allure results already exist and you need agent-readable markdown and manifests without rerunning tests locally. Repeat `--dump` to merge multiple environments or jobs.",
  "`allure agent latest`: output recovery loop. Use when a previous run omitted `--output`, you need the newest output directory and `index.md` path, or a follow-up task needs prior output before selecting or rerunning tests.",
  "`allure agent state-dir`: tooling diagnosis loop. Use when `latest` cannot find a run, CI or sandbox state looks wrong, or you need to explain where project-scoped latest pointers are stored.",
  "`allure agent query --latest summary|tests|findings|test` / `allure agent query --from <output-dir> ...`: output inspection loop. Use when you need a focused JSON summary, filtered tests, filtered findings, or one test from prior agent output without manually loading raw manifests first.",
  "`allure agent select --latest` / `allure agent select --from <output-dir>`: rerun-planning loop. Use when you need to inspect, filter, or write the Allure test plan from prior results before executing another run. Without `--output`, stdout is raw testplan JSON; with `--output`, stdout summarizes the file path, source output, preset, and selected count.",
  "`allure agent --rerun-latest` / `allure agent --rerun-from <output-dir>`: focused retry loop. Use when prior output already identifies failed, unsuccessful, or review-targeted tests and you should rerun that slice through Allure testplan support instead of rebuilding runner-specific test names.",
  "`ALLURE_AGENT_STATE_DIR=<dir>`: CI and sandbox state-control loop. Use when multiple jobs need a deterministic state location, the default temp state is not shared, or the default state directory is not writable.",
] as const;

export const AGENT_VERIFICATION_RULES = [
  "If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure agent`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.",
  "Use `allure agent` for smoke checks too, even when the change is small or mechanical.",
  "Only skip agent mode when it is impossible or when you are debugging agent mode itself.",
  "After changing a package in this repository, run that package build command before finalizing (for example, `yarn workspace <package-name> build`).",
  "After each agent-mode test run, print the `index.md` path from that run's output directory so users can open the run overview quickly.",
] as const;

export const AGENT_TEST_ENRICHMENT_BEST_PRACTICES = [
  "Steps must wrap real actions, state transitions, or assertions. Prefer a small setup/action/assertion narrative over event-by-event step spam.",
  "Attachments must capture real runtime evidence from that execution: payloads, responses, screenshots, DOM snapshots, diffs, logs, or traces.",
  "Add metadata only when it improves scope review, debugging, or downstream policy. Keep labels and parameters intentionally minimal.",
  "If multiple call sites need the same evidence, instrument the helper once. Example: teach `runCommand` to emit a step instead of wrapping every `runCommand(...)` call site with identical step blocks.",
] as const;

export const AGENT_ANTI_DUMMY_POLICY = [
  "Do not add empty wrapper steps, placeholder attachments, or generic strings such as `passed`, `success`, or static boilerplate.",
  "Do not attach evidence that is not grounded in the current test execution. Synthetic summaries are fine only when they are derived from real runtime artifacts.",
  "Do not inflate metadata with labels, stories, or severities that no expectation, review step, or policy actually uses.",
] as const;

export const AGENT_ACCEPTANCE_CHECKLIST = [
  "The rerun matches the intended scope and does not trigger forbidden or unexpected-test findings.",
  "Each touched test shows enough evidence to explain what happened and what was verified.",
  "Retries include per-attempt diagnostics when the same test reruns.",
  "No high-confidence anti-dummy findings remain, especially `noop-dominated-steps` or low-signal `step-spam` traces.",
] as const;

export const AGENT_REVIEW_COMPLETENESS_CHECKLIST = [
  "The relevant scope was run with agent mode unless that was impossible.",
  "Scoped reviews created expectations before the final rerun, unless the task was an intentionally broad package-health audit.",
  "The final conclusion was based on `manifest/run.json`, `manifest/test-events.jsonl`, `index.md`, `manifest/tests.jsonl`, and `manifest/findings.jsonl` rather than console output alone.",
  "Any missing or partial runtime modeling was called out explicitly before the review was considered complete.",
] as const;

export const AGENT_PARTIAL_RUNTIME_REVIEW_RULES = [
  "Suite-load, import, or setup failures may appear only in `artifacts/global/stderr.txt` or global errors instead of `manifest/tests.jsonl`.",
  "If runner-visible failures are not represented as logical tests, inspect global stderr and treat the run as a partial runtime review, not a clean result set.",
  "Console-only conclusions stay provisional when agent output is missing, incomplete, or partially modeled.",
] as const;

export const AGENT_INSTRUCTIONS_TEMPLATE = `## Allure Agent Mode Instructions

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through \`allure agent\`. It preserves the original console logs and adds agent-mode artifacts without inheriting the normal report or export plugins from the project config.
- Use \`allure agent\` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.
- After each agent-mode test run, print the \`index.md\` path from that run's output directory so users can open the run overview quickly.
- Use \`allure agent latest\` to print the newest output directory and \`index.md\` path when \`--output\` was omitted.
- Use \`allure agent capabilities --json\` when you need structured supported-command, expectation, output, rerun, and unsupported-feature data without scraping help text.
- Use \`allure agent state-dir\` to inspect where the current project stores its latest-agent state.
- Use \`allure agent latest\`, \`state-dir\`, \`query\`, \`select\`, and \`--rerun-*\` according to their loop/task/problem mapping instead of treating them as interchangeable helper commands.
- Use \`allure agent inspect <allure-results-dir-or-glob>\` or \`allure agent inspect --dump <archive-or-glob>\` when you need agent-readable markdown and manifests from existing Allure results without rerunning tests locally; repeat \`--dump\` for multiple CI jobs or environments.
- Use \`allure agent query --latest summary|tests|findings|test\` or \`allure agent query --from <output-dir> ...\` to inspect prior output as focused JSON before manually opening raw manifests.
- Use \`allure agent select --latest\` or \`allure agent select --from <output-dir>\` to inspect the review-targeted test plan before rerunning; add \`--output <file>\` when you want the CLI to write the plan and print a short selection summary.
- Use \`allure agent --rerun-latest -- <command>\` or \`allure agent --rerun-from <output-dir> -- <command>\` to rerun only the selected tests.
- When rerunning previous failures, use \`allure agent --rerun-latest --rerun-preset failed -- <command>\` or \`allure agent --rerun-from <output-dir> --rerun-preset failed -- <command>\` instead of manually rebuilding runner-specific test names.
- Use \`--rerun-preset review|failed|unsuccessful|all\`, repeated \`--rerun-environment <id>\`, and repeated \`--rerun-label name=value\` when you need a narrower rerun selection from the previous output.
- Use \`ALLURE_AGENT_STATE_DIR\` when you need to override where the current project stores latest-agent state for \`latest\`, \`state-dir\`, or \`--rerun-latest\`.
- Prefer inline \`allure agent\` expectation flags such as \`--goal\`, \`--expect-tests\`, \`--expect-test\`, \`--expect-label\`, and \`--expect-step-containing\`; use \`--expectations <file>\` only when flags become awkward.
- Run tests with \`allure agent\` and review \`manifest/run.json\`, \`manifest/test-events.jsonl\`, \`index.md\`, \`manifest/tests.jsonl\`, and \`manifest/findings.jsonl\`.
- Enrich only the intended tests. Add real steps for real setup, actions, and assertions.
- Attach only real runtime evidence such as payloads, responses, screenshots, DOM snapshots, diffs, logs, or traces.
- Keep metadata minimal. Add labels or severity only when scope review, debugging, or quality policy uses them.
- Instrument stable helpers when several call sites need the same evidence. For example, teach \`runCommand\` to emit a step instead of wrapping every caller.
- Reject the rerun if scope drifts, evidence stays weak, or high-confidence noop-style findings remain.`;

const renderBullets = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");

const renderRemediationGuide = () =>
  Object.entries(ENRICHMENT_ACTIONS_BY_CHECK_NAME)
    .map(([checkName, action]) => `- \`${checkName}\`: ${action.title}. ${action.guidance}`)
    .join("\n");

export const renderAgentsGuide = () =>
  `# AGENTS Guide

## Reading Order

1. Read \`manifest/run.json\` for the current phase, counts, and modeling summary.
2. Tail \`manifest/test-events.jsonl\` for the newest structured updates while the run is active.
3. Open \`index.md\` for run-level status, scope summary, and the highest-priority findings.
4. Open the relevant file under \`tests/<environment>/<historyId-or-trId>.md\` for evidence review.
5. Follow links into \`.assets/\` for test-scoped artifacts and into \`artifacts/global/\` for process logs such as stdout and stderr.

## Directory Contract

- \`index.md\` contains the triage-oriented run overview.
- \`manifest/run.json\` is the canonical machine-readable run summary.
- \`manifest/test-events.jsonl\` is the append-only live event stream for machine consumers during the run.
- \`manifest/tests.jsonl\` contains one logical test summary per line.
- \`manifest/findings.jsonl\` contains one advisory finding per line.
- \`manifest/expected.json\` contains normalized expectations from inline flags or \`--expectations <file>\` when provided.
- \`tests/<environment>/<slug>.md\` contains one logical test per file.
- Retries from the same run are nested inside the same logical test file.
- \`tests/<environment>/<slug>.assets/\` contains copied attachments for that logical test.
- \`artifacts/global/\` contains copied global artifacts for the whole run.

## Command Task Map

${renderBullets(AGENT_COMMAND_TASK_MAP)}

## Agent Workflows

${AGENT_WORKFLOWS_MARKDOWN}

## Verification Standard

${renderBullets(AGENT_VERIFICATION_RULES)}

## Test Enrichment Best Practices

${renderBullets(AGENT_TEST_ENRICHMENT_BEST_PRACTICES)}

## Anti-Dummy Policy

${renderBullets(AGENT_ANTI_DUMMY_POLICY)}

## Acceptance Checklist

${renderBullets(AGENT_ACCEPTANCE_CHECKLIST)}

## Review Completeness

${renderBullets(AGENT_REVIEW_COMPLETENESS_CHECKLIST)}

## Partial Runtime Review

${renderBullets(AGENT_PARTIAL_RUNTIME_REVIEW_RULES)}

## Remediation Guide

${renderRemediationGuide()}
`;
