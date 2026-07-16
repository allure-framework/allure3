import { spawnSync } from "node:child_process";

import { type Mock, describe, it, vi, expect } from "vitest";

import { isGitAvailable } from "../src/isGitAvailable.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const spawnSyncMock = spawnSync as Mock;

describe("isGitAvailable", () => {
  it("returns true when git --version succeeds", () => {
    spawnSyncMock.mockReturnValue({ error: undefined, status: 0 });

    const available = isGitAvailable();

    expect(
      {
        available,
        command: spawnSyncMock.mock.calls[0],
      },
      "detects git CLI availability from a successful git --version call",
    ).toEqual({
      available: true,
      command: ["git", ["--version"], { encoding: "utf-8" }],
    });
  });

  it("returns false when git is missing or fails", () => {
    spawnSyncMock.mockReturnValue({ error: new Error("ENOENT"), status: 1 });

    expect(isGitAvailable(), "returns false when git --version fails or git is missing").toBe(false);
  });
});
