# Allure Agent Enrichment Loop

Canonical downstream guidance now lives in two product-facing places:

- generated `AGENTS.md` in every agent-mode output directory
- the published `@allurereport/plugin-agent` README
- project `docs/allure-agent-mode.md` when a repository adopts the skills-based setup flow

This document remains a maintainer companion for developing the plugin and harness
inside this repository.

## Goal

The Allure agent plugin is intentionally read-only. It records what happened in the
test run, but it does not mutate tests or invent evidence.

The enrichment loop sits above that output:

1. Generate `ALLURE_AGENT_EXPECTATIONS` as a fresh per-run YAML or JSON file.
2. Run tests with `allure agent`, or use the lower-level `ALLURE_AGENT_*` plus `allure run` fallback when you need direct environment control.
3. Review `manifest/run.json`, `manifest/tests.jsonl`, and `manifest/findings.jsonl`.
4. Enrich only the targeted tests with real runtime metadata.
5. Rerun the same scope and accept the change only when scope matches and the
   resulting evidence is strong enough to review.

The harness API exported by `@allurereport/plugin-agent` implements the machine
part of this loop:

- `buildAgentExpectations(...)` creates the JSON payload to write to
  `ALLURE_AGENT_EXPECTATIONS`.
- `loadAgentOutput(...)` reads the manifest contract from an agent output directory.
- `planAgentEnrichmentReview(...)` maps existing `check_name` values to concrete
  enrichment actions and produces an acceptance decision.
- `reviewAgentOutput(...)` is the convenience wrapper that loads and reviews in one call.

## Acceptance Policy

The harness stays advisory for raw execution, but it is strict for enrichment review:

- reject when scope drifts from expectations
- reject when high-confidence noop-style evidence remains
- iterate when evidence is still too weak
- accept only when scope matches, expectations are present, and no blocking evidence gaps remain

Current blocking signals:

- scope drift:
  - `missing-expected-test`
  - `missing-expected-prefix`
  - `missing-expected-environment`
  - `unexpected-environment`
  - `forbidden-selector-match`
  - `unexpected-test`
- evidence still missing:
  - `failed-without-useful-steps`
  - `failed-without-attachments`
  - `nontrivial-run-with-empty-trace`
  - `retries-without-new-evidence`
  - `passed-without-observable-evidence`
  - `metadata-mismatch`
  - `history-id-collision`
- anti-dummy:
  - `noop-dominated-steps` at or above the configured confidence threshold

## Remediation Mapping

The harness reuses the existing `check_name` values instead of inventing a second
diagnosis channel.

| `check_name` | Action category | Expected remediation |
| --- | --- | --- |
| `failed-without-useful-steps` | `add-meaningful-steps` | Add setup, action, and assertion steps around real behavior |
| `nontrivial-run-with-empty-trace` | `add-meaningful-steps` | Make the execution path observable with real runtime state |
| `passed-without-observable-evidence` | `add-meaningful-steps` | Show what the passing path actually verified |
| `failed-without-attachments` | `add-test-attachments` | Add real payloads, responses, screenshots, DOM snapshots, diffs, or logs |
| `global-only-artifacts` | `add-test-attachments` | Move evidence closer to the relevant test or step |
| `metadata-mismatch` | `repair-test-metadata` | Add only the minimal labels or parameters needed for scope review |
| `retries-without-new-evidence` | `add-retry-diagnostics` | Add per-attempt evidence so retries show what changed |
| `noop-dominated-steps` | `collapse-low-signal-trace` | Remove noop wrappers and replace bulk event spam with compact evidence |
| `step-spam` | `collapse-low-signal-trace` | Reduce event spam and prefer one focused attachment when appropriate |

## Metadata Baseline

Keep metadata intentionally small:

- require a feature or task label when the run is scoped to a feature or task
- add severity only when it matters for review or quality-gate policy
- keep owner, layer, epic, story, and similar taxonomy optional unless the repo already uses them
- do not add labels that are not used by scope checks, review, or downstream policy

## Runtime Enrichment Examples

Canonical JS/Vitest patterns already live in:

- `packages/sandbox/test/bulk.spec.ts`
- `packages/sandbox/test/legacy.spec.ts`

Use those APIs to add real evidence, not placeholders:

```ts
import { attachment, label, step } from "allure-js-commons";
import { expect, it } from "vitest";

it("creates an order", async () => {
  await label("feature", "orders");
  await label("severity", "critical");

  const request = await step("prepare order payload", async () => {
    const payload = { sku: "book-123", quantity: 1 };

    await attachment("request.json", JSON.stringify(payload, null, 2), "application/json");
    return payload;
  });

  const response = await step("submit order", async () => {
    const result = await createOrder(request);

    await attachment("response.json", JSON.stringify(result, null, 2), "application/json");
    return result;
  });

  await step("assert order was created", () => {
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
  });
});
```

## Anti-Dummy Rules

Valid enrichment:

- every step corresponds to a real action, state transition, or check
- every attachment captures real runtime data from that execution
- metadata exists because the review loop uses it

Rejected enrichment:

```ts
await step("success", () => {});
await attachment("result.txt", "test passed", "text/plain");
await label("feature", "placeholder");
```

Why it is rejected:

- the step records no real behavior
- the attachment is generic text, not runtime evidence
- the label is meaningless unless it is used by scope or policy

## Minimal Harness Example

```ts
import { buildAgentExpectations, reviewAgentOutput } from "@allurereport/plugin-agent";
import { writeFile } from "node:fs/promises";

const expectations = buildAgentExpectations({
  goal: "Validate feature A",
  taskId: "feature-a",
  target: {
    environments: ["default"],
    fullNamePrefixes: ["feature A"],
    labelValues: { feature: "feature-a" },
  },
  forbidden: {
    fullNamePrefixes: ["feature B"],
    labelValues: { feature: ["feature-b", "legacy-feature"] },
  },
  notes: ["Only feature A tests should run."],
});

await writeFile("./out/agent-expected.json", JSON.stringify(expectations, null, 2));

const review = await reviewAgentOutput("./out/agent-report");

if (review.status !== "accept") {
  for (const item of review.plan) {
    console.log(item.checkName, item.category, item.remediationHint);
  }
}
```
