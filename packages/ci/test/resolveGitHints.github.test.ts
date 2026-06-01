import { readFileSync } from "node:fs";

import { CiType, type CiDescriptor, GitProvider } from "@allurereport/core-api";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveGithubGitHints } from "../src/gitHints/index.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
}));

const githubCi = {
  type: CiType.Github,
  jobRunBranch: "feature/foo",
  pullRequestUrl: "https://github.com/myorg/myrepo/pull/42",
  pullRequestName: "Pull request #42",
} as CiDescriptor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveGithubGitHints", () => {
  it("maps repository, branches, and pull request for PR workflow", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_REPOSITORY: "myorg/myrepo",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_REF_NAME: "42/merge",
        GITHUB_REF: "refs/heads/feature/foo",
      };

      return env[key] ?? "";
    });

    expect(resolveGithubGitHints(githubCi)).toEqual({
      provider: GitProvider.Github,
      repository: {
        slug: "myorg/myrepo",
        url: "https://github.com/myorg/myrepo",
      },
      sourceBranch: "feature/foo",
      targetBranch: "main",
      pullRequest: {
        id: "42",
        url: "https://github.com/myorg/myrepo/pull/42",
        title: "Pull request #42",
      },
    });
  });

  it("resolves pull request id from GITHUB_REF merge ref", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_REPOSITORY: "myorg/myrepo",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_REF: "refs/pull/99/merge",
        GITHUB_REF_NAME: "99",
      };

      return env[key] ?? "";
    });

    expect(resolveGithubGitHints(githubCi).pullRequest?.id).toBe("99");
  });

  it("resolves pull request id from GITHUB_EVENT_PATH for pull_request_target workflows", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        GITHUB_REPOSITORY: "myorg/myrepo",
        GITHUB_HEAD_REF: "feature/foo",
        GITHUB_BASE_REF: "main",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_NAME: "main",
        GITHUB_EVENT_PATH: "/tmp/event.json",
      };

      return env[key] ?? "";
    });
    (readFileSync as Mock).mockReturnValue(JSON.stringify({ pull_request: { number: 77 } }));

    expect(resolveGithubGitHints(githubCi).pullRequest?.id).toBe("77");
  });

  it("uses GITHUB_REF branch when HEAD_REF is empty", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      if (key === "GITHUB_REPOSITORY") {
        return "myorg/myrepo";
      }

      if (key === "GITHUB_REF") {
        return "refs/heads/main";
      }

      return "";
    });

    expect(resolveGithubGitHints(githubCi).sourceBranch).toBe("main");
    expect(resolveGithubGitHints(githubCi).pullRequest).toBeUndefined();
  });
});
