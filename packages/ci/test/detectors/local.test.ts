import type { SpawnSyncReturns } from "node:child_process";
import * as childProcess from "node:child_process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { local } from "../../src/detectors/local.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("local", () => {
  describe("repoName", () => {
    it("should return the repository name when git command succeeds", () => {
      const mockOutput: Partial<SpawnSyncReturns<Buffer>> = {
        stdout: Buffer.from("/Users/user/projects/myrepo\n"),
        stderr: Buffer.from(""),
        error: undefined,
      };

      (childProcess.spawnSync as Mock).mockReturnValue(mockOutput);

      expect(local.repoName).toBe("myrepo");
    });

    it("should return empty string when unable to extract repository name", () => {
      const mockOutput: Partial<SpawnSyncReturns<Buffer>> = {
        stdout: Buffer.from("\n"),
        stderr: Buffer.from(""),
        error: undefined,
      };

      (childProcess.spawnSync as Mock).mockReturnValue(mockOutput);

      expect(local.repoName).toBe("");
    });

    it("should return empty string when git command fails with error", () => {
      const mockOutput: Partial<SpawnSyncReturns<Buffer>> = {
        stdout: Buffer.from(""),
        stderr: Buffer.from("fatal: not a git repository"),
        error: new Error("Command failed"),
      };

      (childProcess.spawnSync as Mock).mockReturnValue(mockOutput);

      expect(local.repoName).toBe("");
    });
  });

  describe("jobRunBranch", () => {
    it("should return the branch name when git command succeeds", () => {
      const mockOutput: Partial<SpawnSyncReturns<Buffer>> = {
        stdout: Buffer.from("main\n"),
        stderr: Buffer.from(""),
        error: undefined,
      };

      (childProcess.spawnSync as Mock).mockReturnValue(mockOutput);

      expect(local.jobRunBranch).toBe("main");
    });

    it("should return empty string when git command fails with error", () => {
      const mockOutput: Partial<SpawnSyncReturns<Buffer>> = {
        stdout: Buffer.from(""),
        stderr: Buffer.from("fatal: not a git repository"),
        error: new Error("Command failed"),
      };

      (childProcess.spawnSync as Mock).mockReturnValue(mockOutput);

      expect(local.jobRunBranch).toBe("");
    });
  });
});
