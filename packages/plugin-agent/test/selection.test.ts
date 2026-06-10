import { epic, feature, label, story } from "allure-js-commons";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeAgentRerunPreset,
  parseAgentLabelFilters,
  resolveAgentSelectionOutputDir,
  selectAgentTestPlan,
} from "../src/selection.js";
import { attachJsonEvidence } from "./evidence.js";

vi.mock("../src/state.js", () => ({
  readLatestAgentState: vi.fn(),
}));
vi.mock("../src/harness.js", () => ({
  loadAgentOutput: vi.fn(),
  planAgentEnrichmentReview: vi.fn(),
}));

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-state");
  await story("agent-select");
  await label("coverage", "agent-state");
  vi.clearAllMocks();
});

describe("agent-select utils", () => {
  it("should select review-targeted tests and apply environment and label filters", async () => {
    const { loadAgentOutput, planAgentEnrichmentReview } = await import("../src/harness.js");

    (loadAgentOutput as Mock).mockResolvedValueOnce({
      outputDir: "/tmp/agent-output",
      run: {},
      tests: [
        {
          environment_id: "default",
          full_name: "suite feature A",
          labels: [
            { name: "feature", value: "checkout" },
            { name: "priority", value: "high" },
          ],
          status: "failed",
          markdown_path: "tests/default/feature-a.md",
        },
        {
          environment_id: "api",
          full_name: "suite feature B",
          labels: [{ name: "feature", value: "payments" }],
          status: "passed",
          markdown_path: "tests/api/feature-b.md",
        },
      ],
      findings: [],
    });
    (planAgentEnrichmentReview as Mock).mockReturnValueOnce({
      rerun: {
        targetedTests: ["suite feature A", "suite feature B"],
      },
    });

    const selection = await selectAgentTestPlan({
      outputDir: "/tmp/agent-output",
      preset: "review",
      environments: ["default"],
      labelFilters: [{ name: "feature", value: "checkout" }],
    });

    await attachJsonEvidence("selected agent test plan", selection);
    expect(selection.outputDir).toBe("/tmp/agent-output");
    expect(selection.preset).toBe("review");
    expect(selection.selectedTests).toHaveLength(1);
    expect(selection.selectedTests[0].full_name).toBe("suite feature A");
    expect(selection.testPlan).toEqual({
      version: "1.0",
      tests: [{ selector: "suite feature A" }],
    });
  });

  it("should resolve latest output directories and parse supported filters", async () => {
    const { readLatestAgentState } = await import("../src/state.js");

    (readLatestAgentState as Mock).mockResolvedValueOnce({
      outputDir: "/tmp/latest-agent-output",
    });

    const resolvedOutputDir = await resolveAgentSelectionOutputDir({ cwd: "/cwd", latest: true });
    const preset = normalizeAgentRerunPreset("failed");
    const labelFilters = parseAgentLabelFilters(["feature=checkout", "priority=high"]);

    await attachJsonEvidence("latest selection resolution", {
      resolvedOutputDir,
      preset,
      labelFilters,
    });
    expect(resolvedOutputDir).toBe("/tmp/latest-agent-output");
    expect(preset).toBe("failed");
    expect(labelFilters).toEqual([
      { name: "feature", value: "checkout" },
      { name: "priority", value: "high" },
    ]);
  });
});
