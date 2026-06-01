import { CiType, type CiDescriptor, GitProvider } from "@allurereport/core-api";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveGitHints } from "../src/resolveGitHints.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const circleCi = {
  type: CiType.Circle,
  jobRunBranch: "feature/foo",
} as CiDescriptor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveGitHints (circle)", () => {
  it("maps CircleCI github repository metadata", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        CIRCLE_REPOSITORY_URL: "https://github.com/myorg/myrepo",
        CIRCLE_BRANCH: "feature/foo",
      };

      return env[key] ?? "";
    });

    expect(resolveGitHints(circleCi)).toEqual({
      provider: GitProvider.Github,
      repository: {
        slug: "myorg/myrepo",
        url: "https://github.com/myorg/myrepo",
      },
      sourceBranch: "feature/foo",
    });
  });

  it("parses pull request id from CIRCLE_PULL_REQUEST URL", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        CIRCLE_REPOSITORY_URL: "https://github.com/myorg/myrepo",
        CIRCLE_BRANCH: "feature/foo",
        CIRCLE_PULL_REQUEST: "https://github.com/myorg/myrepo/pull/55",
      };

      return env[key] ?? "";
    });

    expect(resolveGitHints(circleCi).pullRequest).toEqual({
      id: "55",
      url: "https://github.com/myorg/myrepo/pull/55",
    });
  });
});
