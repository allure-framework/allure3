import { spawnSync } from "node:child_process";

import { CiType, type CiDescriptor, GitProvider } from "@allurereport/core-api";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveGitHints } from "../src/resolveGitHints.js";

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const localCi = {
  type: CiType.Local,
  jobRunBranch: "main",
} as CiDescriptor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveGitHints (local)", () => {
  it("maps origin remote to supported git provider hints", () => {
    (spawnSync as Mock).mockReturnValue({
      error: undefined,
      stdout: Buffer.from("git@github.com:myorg/myrepo.git\n"),
    });

    expect(resolveGitHints(localCi)).toEqual({
      provider: GitProvider.Github,
      repository: {
        slug: "myorg/myrepo",
        url: "https://github.com/myorg/myrepo",
      },
      sourceBranch: "main",
    });
  });

  it("returns empty hints when origin remote is missing", () => {
    (spawnSync as Mock).mockReturnValue({
      error: new Error("not a git repository"),
      stdout: Buffer.from(""),
    });

    expect(resolveGitHints(localCi)).toEqual({});
  });
});
