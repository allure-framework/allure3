import { CiType, type CiDescriptor, GitProvider } from "@allurereport/core-api";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveGitlabGitHints } from "../src/gitHints/index.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const gitlabCi = {
  type: CiType.Gitlab,
  jobRunBranch: "feature/foo",
  pullRequestUrl: "https://gitlab.com/myorg/myrepo/-/merge_requests/7",
  pullRequestName: "Fix things",
} as CiDescriptor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveGitlabGitHints", () => {
  it("maps merge request metadata and branches", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        CI_PROJECT_PATH: "myorg/myrepo",
        CI_PROJECT_URL: "https://gitlab.com/myorg/myrepo",
        CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: "feature/foo",
        CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "main",
        CI_MERGE_REQUEST_IID: "7",
        CI_MERGE_REQUEST_TITLE: "Fix things",
        CI_COMMIT_REF_NAME: "feature/foo",
      };

      return env[key] ?? "";
    });

    expect(resolveGitlabGitHints(gitlabCi)).toEqual({
      provider: GitProvider.Gitlab,
      repository: {
        slug: "myorg/myrepo",
        url: "https://gitlab.com/myorg/myrepo",
      },
      sourceBranch: "feature/foo",
      targetBranch: "main",
      pullRequest: {
        id: "7",
        url: "https://gitlab.com/myorg/myrepo/-/merge_requests/7",
        title: "Fix things",
      },
    });
  });
});
