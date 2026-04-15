import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ALLURE_AGENT_STATE_DIR_ENV,
  readLatestAgentState,
  resolveAgentStateDir,
  writeLatestAgentState,
} from "../../src/utils/agent-state.js";

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal()),
  tmpdir: vi.fn().mockReturnValue("/tmp"),
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal()),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
  rename: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env[ALLURE_AGENT_STATE_DIR_ENV];
});

describe("agent-state utils", () => {
  it("should persist latest state under the computed temp state dir for each project cwd", async () => {
    const fsModule = await import("node:fs/promises");
    const cwd = "/repo";
    const projectHash = createHash("sha256").update(cwd).digest("hex").slice(0, 16);
    const statePath = join("/tmp", `allure-agent-state-${projectHash}`, "latest.json");

    await writeLatestAgentState({
      cwd,
      outputDir: "/tmp/allure-agent-123",
      command: "npm test",
      startedAt: "2026-04-15T18:00:00.000Z",
      status: "running",
    });

    expect(fsModule.mkdir).toHaveBeenCalledWith(dirname(statePath), { recursive: true });
    expect(fsModule.writeFile).toHaveBeenCalledWith(
      `${statePath}.${process.pid}.tmp`,
      expect.stringContaining('"schema": "allure-agent-latest/v1"'),
      "utf-8",
    );
    expect(fsModule.rename).toHaveBeenCalledWith(`${statePath}.${process.pid}.tmp`, statePath);
  });

  it("should resolve an explicit state dir override from the environment", () => {
    process.env[ALLURE_AGENT_STATE_DIR_ENV] = "/custom-agent-state";

    expect(resolveAgentStateDir("/repo")).toBe("/custom-agent-state");
  });

  it("should return undefined when no latest state exists for the project", async () => {
    const fsModule = await import("node:fs/promises");

    (fsModule.readFile as Mock).mockRejectedValueOnce(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    await expect(readLatestAgentState("/repo")).resolves.toBeUndefined();
  });
});
