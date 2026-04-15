import { run, UsageError } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentSelectCommand } from "../../src/commands/agent.js";
import { resolveAgentSelectionOutputDir, selectAgentTestPlan } from "../../src/utils/agent-select.js";

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:process", async (importOriginal) => ({
  ...(await importOriginal()),
  exit: vi.fn(),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal()),
  realpath: vi.fn().mockResolvedValue("/cwd"),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/utils/agent-select.js", () => ({
  normalizeAgentRerunPreset: vi.fn((value?: string) => (value ?? "review")),
  parseAgentLabelFilters: vi.fn((values?: string[]) =>
    (values ?? []).map((value) => {
      const [name, filterValue] = value.split("=");

      return {
        name,
        value: filterValue,
      };
    }),
  ),
  resolveAgentSelectionOutputDir: vi.fn(),
  selectAgentTestPlan: vi.fn(),
  createAgentTestPlanContext: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("agent select command", () => {
  it("should fail with usage error when neither --from nor --latest is provided", async () => {
    const command = new AgentSelectCommand();

    (resolveAgentSelectionOutputDir as Mock).mockRejectedValueOnce(
      new UsageError("Expected either --from <path> or --latest"),
    );

    await expect(command.execute()).rejects.toBeInstanceOf(UsageError);
  });

  it("should print the selected test plan to stdout", async () => {
    const consoleModule = await import("node:console");

    (resolveAgentSelectionOutputDir as Mock).mockResolvedValueOnce("/tmp/agent-output");
    (selectAgentTestPlan as Mock).mockResolvedValueOnce({
      outputDir: "/tmp/agent-output",
      preset: "review",
      selectedTests: [{ full_name: "suite feature A" }],
      testPlan: {
        version: "1.0",
        tests: [{ selector: "suite feature A" }],
      },
    });

    await run(AgentSelectCommand, ["agent", "select", "--from", "./agent-output"]);

    expect(resolveAgentSelectionOutputDir).toHaveBeenCalledWith({
      cwd: "/cwd",
      from: "./agent-output",
      latest: false,
    });
    expect(consoleModule.log).toHaveBeenCalledWith(`{\n  "version": "1.0",\n  "tests": [\n    {\n      "selector": "suite feature A"\n    }\n  ]\n}`);
  });
});
