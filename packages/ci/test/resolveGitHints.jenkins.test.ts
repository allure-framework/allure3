import { CiType, type CiDescriptor, GitProvider } from "@allurereport/core-api";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveGitHints } from "../src/resolveGitHints.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const jenkinsCi = {
  type: CiType.Jenkins,
  jobRunBranch: "main",
  pullRequestUrl: "https://github.com/myorg/myrepo/pull/15",
  pullRequestName: "Fix things",
} as CiDescriptor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveGitHints (jenkins)", () => {
  it("maps github repository and pull request from Jenkins env", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GIT_URL: "https://github.com/myorg/myrepo.git",
        CHANGE_ID: "15",
        CHANGE_BRANCH: "feature/foo",
        CHANGE_TARGET: "main",
        CHANGE_URL: "https://github.com/myorg/myrepo/pull/15",
        CHANGE_TITLE: "Fix things",
      };

      return env[key] ?? "";
    });

    expect(resolveGitHints(jenkinsCi)).toEqual({
      provider: GitProvider.Github,
      repository: {
        slug: "myorg/myrepo",
        url: "https://github.com/myorg/myrepo",
      },
      sourceBranch: "feature/foo",
      targetBranch: "main",
      pullRequest: {
        id: "15",
        url: "https://github.com/myorg/myrepo/pull/15",
        title: "Fix things",
      },
    });
  });

  it("returns empty hints when git remote is not a supported host", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      if (key === "GIT_URL") {
        return "https://dev.azure.com/org/project/_git/repo";
      }

      return "";
    });

    expect(resolveGitHints(jenkinsCi)).toEqual({});
  });
});
