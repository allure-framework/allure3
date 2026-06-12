import { CiType, type CiDescriptor, GitProvider } from "@allurereport/core-api";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveBitbucketGitHints } from "../src/gitHints/index.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const bitbucketCi = {
  type: CiType.Bitbucket,
  jobRunBranch: "feature/foo",
  pullRequestUrl: "https://bitbucket.org/myorg/myrepo/pull-requests/15",
  pullRequestName: "",
} as CiDescriptor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveBitbucketGitHints", () => {
  it("maps repository, branches, and pull request", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        BITBUCKET_REPO_FULL_NAME: "myorg/myrepo",
        BITBUCKET_GIT_HTTP_ORIGIN: "https://bitbucket.org/myorg/myrepo",
        BITBUCKET_BRANCH: "feature/foo",
        BITBUCKET_PR_DESTINATION_BRANCH: "main",
        BITBUCKET_PR_ID: "15",
      };

      return env[key] ?? "";
    });

    expect(resolveBitbucketGitHints(bitbucketCi)).toEqual({
      provider: GitProvider.Bitbucket,
      repository: {
        slug: "myorg/myrepo",
        url: "https://bitbucket.org/myorg/myrepo",
      },
      sourceBranch: "feature/foo",
      targetBranch: "main",
      pullRequest: {
        id: "15",
        url: "https://bitbucket.org/myorg/myrepo/pull-requests/15",
        title: undefined,
      },
    });
  });
});
