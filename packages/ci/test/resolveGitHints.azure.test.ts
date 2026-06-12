import { CiType, type CiDescriptor, GitProvider } from "@allurereport/core-api";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveGitHints } from "../src/resolveGitHints.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const azureCi = {
  type: CiType.Azure,
  jobRunBranch: "feature/foo",
  pullRequestUrl: "https://github.com/myorg/myrepo/pull/9",
} as CiDescriptor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveGitHints (azure)", () => {
  it("maps github-backed Azure pipeline to github git hints", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        BUILD_REPOSITORY_PROVIDER: "GitHub",
        BUILD_REPOSITORY_URI: "https://github.com/myorg/myrepo",
        BUILD_REPOSITORY_NAME: "myrepo",
        SYSTEM_PULLREQUEST_PULLREQUESTNUMBER: "9",
        SYSTEM_PULLREQUEST_SOURCEBRANCH: "refs/heads/feature/foo",
        SYSTEM_PULLREQUEST_TARGETBRANCH: "refs/heads/main",
      };

      return env[key] ?? "";
    });

    expect(resolveGitHints(azureCi)).toEqual({
      provider: GitProvider.Github,
      repository: {
        slug: "myorg/myrepo",
        url: "https://github.com/myorg/myrepo",
      },
      sourceBranch: "feature/foo",
      targetBranch: "main",
      pullRequest: {
        id: "9",
        url: "https://github.com/myorg/myrepo/pull/9",
      },
    });
  });

  it("returns empty hints for Azure Repos without a supported git host", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        BUILD_REPOSITORY_PROVIDER: "TfsGit",
        BUILD_REPOSITORY_URI: "https://dev.azure.com/myorg/myproject/_git/myrepo",
        BUILD_SOURCEBRANCHNAME: "main",
      };

      return env[key] ?? "";
    });

    expect(resolveGitHints(azureCi)).toEqual({});
  });
});
