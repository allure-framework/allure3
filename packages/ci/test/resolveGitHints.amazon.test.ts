import { CiType, type CiDescriptor, GitProvider } from "@allurereport/core-api";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveGitHints } from "../src/resolveGitHints.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const amazonCi = {
  type: CiType.Amazon,
  jobRunBranch: "main",
} as CiDescriptor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveGitHints (amazon)", () => {
  it("maps CodeBuild github source to git hints", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        CODEBUILD_SOURCE_REPO_URL: "https://github.com/myorg/myrepo.git",
        CODEBUILD_SOURCE_VERSION: "pr/12",
        CODEBUILD_WEBHOOK_TRIGGER: "pr/12",
        CODEBUILD_WEBHOOK_HEAD_REF: "feature/foo",
        CODEBUILD_WEBHOOK_BASE_REF: "main",
      };

      return env[key] ?? "";
    });

    expect(resolveGitHints(amazonCi)).toEqual({
      provider: GitProvider.Github,
      repository: {
        slug: "myorg/myrepo",
        url: "https://github.com/myorg/myrepo",
      },
      sourceBranch: "feature/foo",
      targetBranch: "main",
      pullRequest: {
        id: "12",
      },
    });
  });
});
