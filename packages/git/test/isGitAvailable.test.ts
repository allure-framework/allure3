import { spawnSync } from "node:child_process";

import { type Mock, describe, expect, it, vi } from "vitest";

import { isGitAvailable } from "../src/isGitAvailable.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const spawnSyncMock = spawnSync as Mock;

describe("isGitAvailable", () => {
  it("returns true when git --version succeeds", () => {
    spawnSyncMock.mockReturnValue({ error: undefined, status: 0 });

    expect(isGitAvailable()).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith("git", ["--version"], { encoding: "utf-8" });
  });

  it("returns false when git is missing or fails", () => {
    spawnSyncMock.mockReturnValue({ error: new Error("ENOENT"), status: 1 });

    expect(isGitAvailable()).toBe(false);
  });
});
