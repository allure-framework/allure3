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
  "invalid-expectations-file": {
    category: "bootstrap-allure",
    title: "Repair the expectations file",
    guidance: "Regenerate a valid YAML or JSON expectations file before the next enrichment iteration.",
  },
  "no-visible-tests": {
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
  "missing-expected-test": {
    category: "narrow-test-scope",
    title: "Bring the intended test back into scope",
    guidance: "Regenerate expectations and rerun only the planned tests or selectors.",
  },
  "missing-expected-prefix": {
    category: "narrow-test-scope",
    title: "Restore the intended name-prefix scope",
    guidance: "Check the selector and rerun only the feature slice that should have matched it.",
  },
  "missing-expected-environment": {
    category: "narrow-test-scope",
    title: "Rerun the intended environment",
    guidance: "Constrain the rerun to the expected environment before accepting the result.",
  },
  "missing-expected-label-selector": {
    category: "repair-test-metadata",
    title: "Add the minimal missing scope label",
    guidance: "Only add the labels required by the expectations selector; do not inflate metadata.",
  },
  "unexpected-environment": {
    category: "narrow-test-scope",
    title: "Remove unrelated environments from the rerun",
    guidance: "Tighten the rerun selector so unrelated environments do not appear in agent output.",
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

export const AGENT_ENRICHMENT_WORKFLOW = [
  "Generate or refresh `ALLURE_AGENT_EXPECTATIONS` before each targeted enrichment iteration.",
  "Run tests with `allure run -- <command>` and `ALLURE_AGENT_OUTPUT` enabled.",
  "Inspect `manifest/run.json`, tail `manifest/test-events.jsonl`, then review `index.md`, `manifest/tests.jsonl`, and `manifest/findings.jsonl` before editing tests.",
  "Enrich only the intended tests, rerun the same scope, and compare the rerun against `manifest/expected.json` when present.",
  "Accept the rerun only when scope is clean, evidence is strong enough to review, and no high-confidence dummy findings remain.",
] as const;

export const AGENT_VERIFICATION_RULES = [
  "If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through `allure run`. It preserves the original console logs and adds agent-mode artifacts when you need them.",
  "Use `allure run` for smoke checks too, even when the change is small or mechanical.",
  "Only skip agent mode when it is impossible or when you are debugging agent mode itself.",
] as const;

export const AGENT_SMALL_TEST_CHANGE_WORKFLOW = [
  "Create a fresh temp `ALLURE_AGENT_OUTPUT` and `ALLURE_AGENT_EXPECTATIONS` for the touched scope before closing the task.",
  "Run the touched scope with `allure run`, even if the goal is only a smoke check after a mechanical change such as typing cleanup, mock refactors, or helper extraction.",
  "Review `manifest/run.json`, `manifest/test-events.jsonl`, `index.md`, `manifest/tests.jsonl`, and `manifest/findings.jsonl` before making any final claim.",
] as const;

export const AGENT_COVERAGE_REVIEW_WORKFLOW = [
  "Split package or business-logic audits into scoped groups and give each group its own temp output directory and expectations file.",
  "Review agent-mode artifacts first for each group, then inspect source code only after the runtime evidence shows what actually ran.",
  "Treat grouped coverage review as incomplete until each scoped run has matching expectations or an explicit note that the audit is intentionally broad.",
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

- If a command executes tests and its result will be used for smoke checking, reasoning, review, coverage analysis, debugging, or any user-facing conclusion, run it through \`allure run\`. It preserves the original console logs and adds agent-mode artifacts when you need them.
- Use \`allure run\` for smoke checks too, even when the change is small or mechanical.
- Only skip agent mode when it is impossible or when you are debugging agent mode itself.
- Generate or refresh \`ALLURE_AGENT_EXPECTATIONS\` before each targeted rerun.
- Run tests with \`ALLURE_AGENT_OUTPUT\` and review \`manifest/run.json\`, \`manifest/test-events.jsonl\`, \`index.md\`, \`manifest/tests.jsonl\`, and \`manifest/findings.jsonl\`.
- Enrich only the intended tests. Add real steps for real setup, actions, and assertions.
- Attach only real runtime evidence such as payloads, responses, screenshots, DOM snapshots, diffs, logs, or traces.
- Keep metadata minimal. Add labels or severity only when scope review, debugging, or quality policy uses them.
- Instrument stable helpers when several call sites need the same evidence. For example, teach \`runCommand\` to emit a step instead of wrapping every caller.
- Reject the rerun if scope drifts, evidence stays weak, or high-confidence noop-style findings remain.`;

const renderBullets = (items: readonly string[]) => items.map((item) => `- ${item}`).join("\n");

const renderNumbered = (items: readonly string[]) => items.map((item, index) => `${index + 1}. ${item}`).join("\n");

const renderRemediationGuide = () =>
  Object.entries(ENRICHMENT_ACTIONS_BY_CHECK_NAME)
    .map(([checkName, action]) => `- \`${checkName}\`: ${action.title}. ${action.guidance}`)
    .join("\n");

export const renderAgentsGuide = (projectGuidePath?: string) =>
  `# AGENTS Guide

## Reading Order

${
  projectGuidePath
    ? `1. Read [project guidance](${projectGuidePath}) first for repo-specific testing conventions and loop expectations.
2. Read \`manifest/run.json\` for the current phase, counts, and modeling summary.
3. Tail \`manifest/test-events.jsonl\` for the newest structured updates while the run is active.
4. Open \`index.md\` for run-level status, scope summary, and the highest-priority findings.
5. Open the relevant file under \`tests/<environment>/<historyId-or-trId>.md\` for evidence review.
6. Follow links into \`.assets/\` for test-scoped artifacts and into \`artifacts/global/\` for process logs such as stdout and stderr.`
    : `1. Read \`manifest/run.json\` for the current phase, counts, and modeling summary.
2. Tail \`manifest/test-events.jsonl\` for the newest structured updates while the run is active.
3. Open \`index.md\` for run-level status, scope summary, and the highest-priority findings.
4. Open the relevant file under \`tests/<environment>/<historyId-or-trId>.md\` for evidence review.
5. Follow links into \`.assets/\` for test-scoped artifacts and into \`artifacts/global/\` for process logs such as stdout and stderr.`
}

## Directory Contract

- \`index.md\` contains the triage-oriented run overview.
- \`manifest/run.json\` is the canonical machine-readable run summary.
- \`manifest/test-events.jsonl\` is the append-only live event stream for machine consumers during the run.
- \`manifest/tests.jsonl\` contains one logical test summary per line.
- \`manifest/findings.jsonl\` contains one advisory finding per line.
- \`manifest/expected.json\` is copied from \`ALLURE_AGENT_EXPECTATIONS\` when provided.
- \`project/docs/allure-agent-mode.md\` is copied from the project when available so each run keeps the guide used for that execution.
- \`tests/<environment>/<slug>.md\` contains one logical test per file.
- Retries from the same run are nested inside the same logical test file.
- \`tests/<environment>/<slug>.assets/\` contains copied attachments for that logical test.
- \`artifacts/global/\` contains copied global artifacts for the whole run.

## Enrichment Loop Workflow

${renderNumbered(AGENT_ENRICHMENT_WORKFLOW)}

## Verification Standard

${renderBullets(AGENT_VERIFICATION_RULES)}

## Small Test Change Workflow

${renderNumbered(AGENT_SMALL_TEST_CHANGE_WORKFLOW)}

## Coverage Review Workflow

${renderNumbered(AGENT_COVERAGE_REVIEW_WORKFLOW)}

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
