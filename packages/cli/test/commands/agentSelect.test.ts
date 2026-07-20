import { dirname, resolve } from "node:path";

import { resolveAgentSelectionOutputDir, selectAgentTestPlan } from "@allurereport/plugin-agent";
import { attachment, epic, feature, label, story } from "allure-js-commons";
import { run, UsageError } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentSelectCommand } from "../../src/commands/agent.js";

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
vi.mock("@allurereport/plugin-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@allurereport/plugin-agent")>();

  return {
    ...actual,
    normalizeAgentRerunPreset: vi.fn((value?: string) => value ?? "review"),
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
  };
});

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agentSelect");
  await label("coverage", "agent-mode");
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
    expect(consoleModule.log).toHaveBeenCalledWith(
      `{\n  "version": "1.0",\n  "tests": [\n    {\n      "selector": "suite feature A"\n    }\n  ]\n}`,
    );
  });

  it("should write the selected test plan and print selection summary when output is provided", async () => {
    const consoleModule = await import("node:console");
    const fsModule = await import("node:fs/promises");
    const outputPath = resolve("/cwd", "./testplan.json");
    const outputDir = dirname(outputPath);

    (resolveAgentSelectionOutputDir as Mock).mockResolvedValueOnce("/tmp/agent-output");
    (selectAgentTestPlan as Mock).mockResolvedValueOnce({
      outputDir: "/tmp/agent-output",
      preset: "failed",
      selectedTests: [{ full_name: "suite feature A" }, { full_name: "suite feature B" }],
      testPlan: {
        version: "1.0",
        tests: [{ selector: "suite feature A" }, { selector: "suite feature B" }],
      },
    });

    await run(AgentSelectCommand, [
      "agent",
      "select",
      "--from",
      "./agent-output",
      "--preset",
      "failed",
      "--output",
      "./testplan.json",
    ]);

    await attachment(
      "selected test plan output path contract",
      JSON.stringify({ outputPath, outputDir }, null, 2),
      "application/json",
    );
    expect(fsModule.mkdir).toHaveBeenCalledWith(outputDir, { recursive: true });
    expect(fsModule.writeFile).toHaveBeenCalledWith(
      outputPath,
      `{\n  "version": "1.0",\n  "tests": [\n    {\n      "selector": "suite feature A"\n    },\n    {\n      "selector": "suite feature B"\n    }\n  ]\n}\n`,
      "utf-8",
    );
    expect(consoleModule.log).toHaveBeenNthCalledWith(1, `agent testplan: ${outputPath}`);
    expect(consoleModule.log).toHaveBeenNthCalledWith(2, "agent selection source: /tmp/agent-output");
    expect(consoleModule.log).toHaveBeenNthCalledWith(3, "agent selection preset: failed");
    expect(consoleModule.log).toHaveBeenNthCalledWith(4, "agent selection tests: 2");
  });
});
