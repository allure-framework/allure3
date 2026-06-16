import { tmpdir } from "node:os";
import { join } from "node:path";

import { readLatestAgentState, resolveAgentStateDir } from "@allurereport/plugin-agent";
import { attachment, epic, feature, label, story } from "allure-js-commons";
import { run } from "clipanion";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentLatestCommand, AgentStateDirCommand } from "../../src/commands/agent.js";

const agentOutputDir = join(tmpdir(), "allure-agent-123");
const agentStateDir = join(tmpdir(), "allure-agent-state");

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
}));
vi.mock("@allurereport/plugin-agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@allurereport/plugin-agent")>();

  return {
    ...actual,
    readLatestAgentState: vi.fn(),
    resolveAgentStateDir: vi.fn(),
    writeAgentRunState: vi.fn(),
  };
});

beforeEach(async () => {
  await epic("coverage");
  await feature("agent-mode");
  await story("agentLatest");
  await label("coverage", "agent-mode");
  vi.clearAllMocks();
});

describe("agent latest command", () => {
  it("should print the latest output directory and index path for the resolved project cwd", async () => {
    const consoleModule = await import("node:console");
    const outputDir = agentOutputDir;
    const indexPath = join(outputDir, "index.md");

    (readLatestAgentState as Mock).mockResolvedValueOnce({
      schema: "allure-agent-run/v1",
      runId: "run-1",
      cwd: "/cwd",
      outputDir,
      managedOutput: true,
      command: "npm test",
      startedAt: 1776276000000,
      status: "finished",
    });

    await run(AgentLatestCommand, ["agent", "latest"]);

    await attachment(
      "latest output path contract",
      JSON.stringify({ outputDir, indexPath }, null, 2),
      "application/json",
    );
    expect(readLatestAgentState).toHaveBeenCalledWith("/cwd");
    expect(consoleModule.log).toHaveBeenNthCalledWith(1, `agent output: ${outputDir}`);
    expect(consoleModule.log).toHaveBeenNthCalledWith(2, `agent index: ${indexPath}`);
  });

  it("should exit with code 1 when no latest output exists for the project", async () => {
    const consoleModule = await import("node:console");
    const processModule = await import("node:process");

    (readLatestAgentState as Mock).mockResolvedValueOnce(undefined);

    await run(AgentLatestCommand, ["agent", "latest"]);

    expect(consoleModule.error).toHaveBeenCalledWith("No latest agent output found for /cwd");
    expect(processModule.exit).toHaveBeenCalledWith(1);
  });

  it("should print the resolved state directory for the current project", async () => {
    const consoleModule = await import("node:console");

    (resolveAgentStateDir as Mock).mockReturnValueOnce(agentStateDir);

    await run(AgentStateDirCommand, ["agent", "state-dir"]);

    await attachment(
      "state directory contract",
      JSON.stringify({ stateDir: agentStateDir }, null, 2),
      "application/json",
    );
    expect(resolveAgentStateDir).toHaveBeenCalledWith("/cwd");
    expect(consoleModule.log).toHaveBeenCalledWith(agentStateDir);
  });
});
