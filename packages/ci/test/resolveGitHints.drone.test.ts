import { CiType, type CiDescriptor, GitProvider } from "@allurereport/core-api";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveGitHints } from "../src/resolveGitHints.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

const droneCi = {
  type: CiType.Drone,
  jobRunBranch: "feature/foo",
  pullRequestUrl: "https://github.com/myorg/myrepo/pull/3",
  pullRequestName: "Drone PR",
} as CiDescriptor;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveGitHints (drone)", () => {
  it("maps github pull request metadata from Drone env", () => {
    (getEnv as Mock).mockImplementation((key: string) => {
      const env: Record<string, string> = {
        DRONE_REPO_LINK: "https://github.com/myorg/myrepo",
        DRONE_PULL_REQUEST: "3",
        DRONE_BRANCH: "feature/foo",
        DRONE_TARGET_BRANCH: "main",
        DRONE_PULL_REQUEST_TITLE: "Drone PR",
      };

      return env[key] ?? "";
    });

    expect(resolveGitHints(droneCi)).toEqual({
      provider: GitProvider.Github,
      repository: {
        slug: "myorg/myrepo",
        url: "https://github.com/myorg/myrepo",
      },
      sourceBranch: "feature/foo",
      targetBranch: "main",
      pullRequest: {
        id: "3",
        url: "https://github.com/myorg/myrepo/pull/3",
        title: "Drone PR",
      },
    });
  });
});
