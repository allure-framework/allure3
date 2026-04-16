import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeAgentRerunPreset,
  parseAgentLabelFilters,
  resolveAgentSelectionOutputDir,
  selectAgentTestPlan,
} from "../../src/utils/agent-select.js";

vi.mock("../../src/utils/agent-state.js", () => ({
  readLatestAgentState: vi.fn(),
}));
vi.mock("@allurereport/plugin-agent", () => ({
  loadAgentOutput: vi.fn(),
  planAgentEnrichmentReview: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agent-select utils", () => {
  it("should select review-targeted tests and apply environment and label filters", async () => {
    const { loadAgentOutput, planAgentEnrichmentReview } = await import("@allurereport/plugin-agent");

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
    const { readLatestAgentState } = await import("../../src/utils/agent-state.js");

    (readLatestAgentState as Mock).mockResolvedValueOnce({
      outputDir: "/tmp/latest-agent-output",
    });

    await expect(resolveAgentSelectionOutputDir({ cwd: "/cwd", latest: true })).resolves.toBe(
      "/tmp/latest-agent-output",
    );
    expect(normalizeAgentRerunPreset("failed")).toBe("failed");
    expect(parseAgentLabelFilters(["feature=checkout", "priority=high"])).toEqual([
      { name: "feature", value: "checkout" },
      { name: "priority", value: "high" },
    ]);
  });
});
