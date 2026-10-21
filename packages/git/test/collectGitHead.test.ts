import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { collectGitHead } from "../src/collectGitHead.js";
import * as runGitModule from "../src/runGit.js";

vi.mock("../src/runGit.js", () => ({
  runGit: vi.fn(),
}));

const runGit = runGitModule.runGit as Mock;

const COMMIT = "a".repeat(40);

const mockGit = (params: { insideWorkTree?: string; commit?: string; branch?: string }) => {
  runGit.mockImplementation((args: string[]) => {
    if (args[0] === "rev-parse" && args[1] === "--is-inside-work-tree") {
      return params.insideWorkTree ?? "true";
    }

    if (args[0] === "rev-parse" && args[1] === "HEAD") {
      return params.commit;
    }

    if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") {
      return params.branch;
    }

    return undefined;
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("collectGitHead", () => {
  it("should return the commit and the branch of HEAD", () => {
    mockGit({ commit: COMMIT, branch: "main" });

    expect(collectGitHead()).toEqual({ commit: COMMIT, branch: "main" });
  });

  it("should omit the branch for a detached HEAD", () => {
    mockGit({ commit: COMMIT, branch: "HEAD" });

    expect(collectGitHead()).toEqual({ commit: COMMIT, branch: undefined });
  });

  it("should return undefined outside of a git work tree", () => {
    mockGit({ insideWorkTree: "false", commit: COMMIT, branch: "main" });

    expect(collectGitHead()).toBeUndefined();
  });

  it("should return undefined when the commit can't be resolved", () => {
    mockGit({ branch: "main" });

    expect(collectGitHead()).toBeUndefined();
  });

  it("should never fetch anything", () => {
    mockGit({ commit: COMMIT, branch: "main" });

    collectGitHead({ cwd: "/repo" });

    expect(runGit.mock.calls.every(([args]) => !args.includes("fetch"))).toBe(true);
    expect(runGit.mock.calls.every(([, cwd]) => cwd === "/repo")).toBe(true);
  });
});
