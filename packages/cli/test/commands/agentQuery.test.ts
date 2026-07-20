import {
  AgentUsageError,
  buildAgentQueryPayload,
  loadAgentOutput,
  resolveAgentSelectionOutputDir,
  type AgentOutputBundle,
} from "@allurereport/plugin-agent";
import { epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentQueryCommand } from "../../src/commands/agent.js";

vi.mock("node:console", async (importOriginal) => ({
  ...(await importOriginal()),
  log: vi.fn(),
  error: vi.fn(),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal()),
  realpath: vi.fn().mockResolvedValue("/cwd"),
}));
vi.mock("@allurereport/plugin-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@allurereport/plugin-agent")>();

  return {
    ...actual,
    buildAgentQueryPayload: vi.fn(),
    loadAgentOutput: vi.fn(),
    resolveAgentSelectionOutputDir: vi.fn(),
  };
});

const agentOutput = {
  outputDir: "/tmp/agent-output",
} as AgentOutputBundle;

const readLoggedJson = async <T>() => {
  const consoleModule = await import("node:console");
  const logMock = consoleModule.log as Mock;

  expect(logMock).toHaveBeenCalledTimes(1);

  return JSON.parse(logMock.mock.calls[0][0]) as T;
};

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agentQuery");
  await label("coverage", "agent-mode");
  vi.clearAllMocks();
  (resolveAgentSelectionOutputDir as Mock).mockResolvedValue("/tmp/agent-output");
  (loadAgentOutput as Mock).mockResolvedValue(agentOutput);
  (buildAgentQueryPayload as Mock).mockResolvedValue({
    schema: "allure-agent-query/v1",
    view: "summary",
    output_dir: "/tmp/agent-output",
  });
});

describe("agent query command", () => {
  it("should resolve the latest output and print the plugin-agent summary payload", async () => {
    await run(AgentQueryCommand, ["agent", "query", "--latest", "summary"]);

    expect(resolveAgentSelectionOutputDir).toHaveBeenCalledWith({
      cwd: "/cwd",
      from: undefined,
      latest: true,
    });
    expect(loadAgentOutput).toHaveBeenCalledWith("/tmp/agent-output");
    expect(buildAgentQueryPayload).toHaveBeenCalledWith(agentOutput, "summary", {
      environments: undefined,
      labelFilters: [],
      statuses: undefined,
      severities: undefined,
      categories: undefined,
      checks: undefined,
      test: undefined,
      limit: undefined,
      includeMarkdown: false,
    });

    await expect(readLoggedJson()).resolves.toEqual({
      schema: "allure-agent-query/v1",
      view: "summary",
      output_dir: "/tmp/agent-output",
    });
  });

  it("should pass test query filters to plugin-agent", async () => {
    (buildAgentQueryPayload as Mock).mockResolvedValueOnce({
      schema: "allure-agent-query/v1",
      view: "tests",
      output_dir: "/tmp/agent-output",
      tests: [],
    });

    await run(AgentQueryCommand, [
      "agent",
      "query",
      "tests",
      "--from",
      "./agent-output",
      "--status",
      "failed",
      "--label",
      "module=cli",
      "--limit",
      "1",
    ]);

    expect(resolveAgentSelectionOutputDir).toHaveBeenCalledWith({
      cwd: "/cwd",
      from: "./agent-output",
      latest: false,
    });
    expect(buildAgentQueryPayload).toHaveBeenCalledWith(agentOutput, "tests", {
      environments: undefined,
      labelFilters: [{ name: "module", value: "cli" }],
      statuses: ["failed"],
      severities: undefined,
      categories: undefined,
      checks: undefined,
      test: undefined,
      limit: 1,
      includeMarkdown: false,
    });

    await expect(readLoggedJson()).resolves.toEqual(
      expect.objectContaining({
        view: "tests",
      }),
    );
  });

  it("should pass finding query filters to plugin-agent", async () => {
    await run(AgentQueryCommand, [
      "agent",
      "query",
      "findings",
      "--from",
      "./agent-output",
      "--severity",
      "high",
      "--category",
      "scope",
      "--check",
      "expected-label-missing",
      "--test",
      "suite should fail",
    ]);

    expect(buildAgentQueryPayload).toHaveBeenCalledWith(agentOutput, "findings", {
      environments: undefined,
      labelFilters: [],
      statuses: undefined,
      severities: ["high"],
      categories: ["scope"],
      checks: ["expected-label-missing"],
      test: "suite should fail",
      limit: undefined,
      includeMarkdown: false,
    });
  });

  it("should pass one-test markdown requests to plugin-agent", async () => {
    await run(AgentQueryCommand, [
      "agent",
      "query",
      "test",
      "--from",
      "./agent-output",
      "--test",
      "suite should fail",
      "--include-markdown",
    ]);

    expect(buildAgentQueryPayload).toHaveBeenCalledWith(agentOutput, "test", {
      environments: undefined,
      labelFilters: [],
      statuses: undefined,
      severities: undefined,
      categories: undefined,
      checks: undefined,
      test: "suite should fail",
      limit: undefined,
      includeMarkdown: true,
    });
  });

  it("should translate plugin-agent query usage errors to CLI failures", async () => {
    (buildAgentQueryPayload as Mock).mockRejectedValueOnce(new AgentUsageError("No tests matched query"));

    const exitCode = await run(AgentQueryCommand, ["agent", "query", "test", "--from", "./agent-output"]);

    expect(exitCode).toBe(1);
  });
});
