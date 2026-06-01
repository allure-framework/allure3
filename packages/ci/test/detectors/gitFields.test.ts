import { spawnSync } from "node:child_process";

import { GitProvider } from "@allurereport/core-api";
import { story } from "allure-js-commons";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

import { amazon } from "../../src/detectors/amazon.js";
import { azure } from "../../src/detectors/azure.js";
import { bitbucket } from "../../src/detectors/bitbucket.js";
import { circle } from "../../src/detectors/circle.js";
import { drone } from "../../src/detectors/drone.js";
import { github } from "../../src/detectors/github.js";
import { gitlab } from "../../src/detectors/gitlab.js";
import { jenkins } from "../../src/detectors/jenkins.js";
import { local } from "../../src/detectors/local.js";
import { getEnv } from "../../src/utils.js";

vi.mock("../../src/utils.js", () => ({
  getEnv: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawnSync: vi.fn(),
}));

const mockEnv = (env: Record<string, string>) => {
  (getEnv as Mock).mockImplementation((key: string) => env[key] ?? "");
};

beforeEach(async () => {
  await story("git fields");
  vi.clearAllMocks();
});

describe("CI descriptor git fields", () => {
  it("maps CodeBuild github source", () => {
    mockEnv({
      CODEBUILD_SOURCE_REPO_URL: "https://github.com/myorg/myrepo.git",
      CODEBUILD_SOURCE_VERSION: "pr/12",
      CODEBUILD_WEBHOOK_TRIGGER: "pr/12",
      CODEBUILD_WEBHOOK_HEAD_REF: "feature/foo",
      CODEBUILD_WEBHOOK_BASE_REF: "main",
    });

    expect(amazon.provider).toBe(GitProvider.Github);
    expect(amazon.repository).toEqual({
      slug: "myorg/myrepo",
      url: "https://github.com/myorg/myrepo",
    });
    expect(amazon.sourceBranch).toBe("feature/foo");
    expect(amazon.targetBranch).toBe("main");
    expect(amazon.pullRequest).toMatchObject({ id: "12" });
  });

  it("maps CodeBuild branch source version with slashes", () => {
    mockEnv({
      CODEBUILD_SOURCE_REPO_URL: "https://github.com/myorg/myrepo.git",
      CODEBUILD_SOURCE_VERSION: "refs/heads/feature/foo",
    });

    expect(amazon.sourceBranch).toBe("feature/foo");
  });

  it("maps CodeBuild branch source version with commit suffix", () => {
    mockEnv({
      CODEBUILD_SOURCE_REPO_URL: "https://github.com/myorg/myrepo.git",
      CODEBUILD_SOURCE_VERSION: "refs/heads/feature/foo^{abc123}",
    });

    expect(amazon.sourceBranch).toBe("feature/foo");
  });

  it("maps github-backed Azure pipeline", () => {
    mockEnv({
      BUILD_REPOSITORY_PROVIDER: "GitHub",
      BUILD_REPOSITORY_URI: "https://github.com/myorg/myrepo",
      BUILD_REPOSITORY_NAME: "myrepo",
      SYSTEM_PULLREQUEST_PULLREQUESTNUMBER: "9",
      SYSTEM_PULLREQUEST_SOURCEBRANCH: "refs/heads/feature/foo",
      SYSTEM_PULLREQUEST_TARGETBRANCH: "refs/heads/main",
    });

    expect(azure.provider).toBe(GitProvider.Github);
    expect(azure.repository).toEqual({
      slug: "myorg/myrepo",
      url: "https://github.com/myorg/myrepo",
    });
    expect(azure.sourceBranch).toBe("feature/foo");
    expect(azure.targetBranch).toBe("main");
    expect(azure.pullRequest).toMatchObject({
      id: "9",
      url: "https://github.com/myorg/myrepo/pull/9",
    });
  });

  it("omits Azure Repos git fields for unsupported host", () => {
    mockEnv({
      BUILD_REPOSITORY_PROVIDER: "TfsGit",
      BUILD_REPOSITORY_URI: "https://dev.azure.com/myorg/myproject/_git/myrepo",
      BUILD_SOURCEBRANCHNAME: "main",
    });

    expect(azure.provider).toBeUndefined();
    expect(azure.repository).toBeUndefined();
  });

  it("maps Bitbucket repository, branches, and pull request", () => {
    mockEnv({
      BITBUCKET_REPO_FULL_NAME: "myorg/myrepo",
      BITBUCKET_GIT_HTTP_ORIGIN: "https://bitbucket.org/myorg/myrepo",
      BITBUCKET_BRANCH: "feature/foo",
      BITBUCKET_PR_DESTINATION_BRANCH: "main",
      BITBUCKET_PR_ID: "15",
    });

    expect(bitbucket.provider).toBe(GitProvider.Bitbucket);
    expect(bitbucket.repository).toEqual({
      slug: "myorg/myrepo",
      url: "https://bitbucket.org/myorg/myrepo",
    });
    expect(bitbucket.sourceBranch).toBe("feature/foo");
    expect(bitbucket.targetBranch).toBe("main");
    expect(bitbucket.pullRequest).toMatchObject({
      id: "15",
      url: "https://bitbucket.org/myorg/myrepo/pull-requests/15",
    });
  });

  it("maps CircleCI github repository metadata", () => {
    mockEnv({
      CIRCLE_REPOSITORY_URL: "https://github.com/myorg/myrepo",
      CIRCLE_BRANCH: "feature/foo",
      CIRCLE_PULL_REQUEST: "https://github.com/myorg/myrepo/pull/55",
    });

    expect(circle.provider).toBe(GitProvider.Github);
    expect(circle.repository).toEqual({
      slug: "myorg/myrepo",
      url: "https://github.com/myorg/myrepo",
    });
    expect(circle.sourceBranch).toBe("feature/foo");
    expect(circle.pullRequest).toMatchObject({
      id: "55",
      url: "https://github.com/myorg/myrepo/pull/55",
    });
  });

  it("maps Drone github pull request metadata", () => {
    mockEnv({
      DRONE_GITHUB_SERVER: "https://github.com",
      DRONE_REPO_LINK: "https://github.com/myorg/myrepo",
      DRONE_PULL_REQUEST: "3",
      DRONE_BRANCH: "feature/foo",
      DRONE_TARGET_BRANCH: "main",
      DRONE_PULL_REQUEST_TITLE: "Drone PR",
    });

    expect(drone.provider).toBe(GitProvider.Github);
    expect(drone.repository).toEqual({
      slug: "myorg/myrepo",
      url: "https://github.com/myorg/myrepo",
    });
    expect(drone.sourceBranch).toBe("feature/foo");
    expect(drone.targetBranch).toBe("main");
    expect(drone.pullRequest).toEqual({
      id: "3",
      url: "https://github.com/myorg/myrepo/pull/3",
      title: "Drone PR",
    });
  });

  it("maps GitHub repository, branches, and pull request", () => {
    mockEnv({
      GITHUB_REPOSITORY: "myorg/myrepo",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_HEAD_REF: "feature/foo",
      GITHUB_BASE_REF: "main",
      GITHUB_REF_NAME: "42/merge",
      GITHUB_REF: "refs/heads/feature/foo",
    });

    expect(github.provider).toBe(GitProvider.Github);
    expect(github.repository).toEqual({
      slug: "myorg/myrepo",
      url: "https://github.com/myorg/myrepo",
    });
    expect(github.sourceBranch).toBe("feature/foo");
    expect(github.targetBranch).toBe("main");
    expect(github.pullRequest).toEqual({
      id: "42",
      url: "https://github.com/myorg/myrepo/pull/42",
      title: "Pull request #42",
    });
  });

  it("does not treat GitHub branch ending with merge as pull request", () => {
    mockEnv({
      GITHUB_REPOSITORY: "myorg/myrepo",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REF_NAME: "release/merge",
      GITHUB_REF: "refs/heads/release/merge",
    });

    expect(github.sourceBranch).toBe("release/merge");
    expect(github.pullRequest).toBeUndefined();
  });

  it("maps GitLab merge request metadata and branches", () => {
    mockEnv({
      CI_PROJECT_PATH: "myorg/myrepo",
      CI_PROJECT_URL: "https://gitlab.com/myorg/myrepo",
      CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: "feature/foo",
      CI_MERGE_REQUEST_TARGET_BRANCH_NAME: "main",
      CI_MERGE_REQUEST_IID: "7",
      CI_MERGE_REQUEST_TITLE: "Fix things",
      CI_COMMIT_REF_NAME: "feature/foo",
    });

    expect(gitlab.provider).toBe(GitProvider.Gitlab);
    expect(gitlab.repository).toEqual({
      slug: "myorg/myrepo",
      url: "https://gitlab.com/myorg/myrepo",
    });
    expect(gitlab.sourceBranch).toBe("feature/foo");
    expect(gitlab.targetBranch).toBe("main");
    expect(gitlab.pullRequest).toEqual({
      id: "7",
      url: "https://gitlab.com/myorg/myrepo/-/merge_requests/7",
      title: "Fix things",
    });
  });

  it("maps Jenkins github repository and pull request", () => {
    mockEnv({
      GIT_URL: "https://github.com/myorg/myrepo.git",
      CHANGE_ID: "15",
      CHANGE_BRANCH: "feature/foo",
      CHANGE_TARGET: "main",
      CHANGE_URL: "https://github.com/myorg/myrepo/pull/15",
      CHANGE_TITLE: "Fix things",
    });

    expect(jenkins.provider).toBe(GitProvider.Github);
    expect(jenkins.repository).toEqual({
      slug: "myorg/myrepo",
      url: "https://github.com/myorg/myrepo",
    });
    expect(jenkins.sourceBranch).toBe("feature/foo");
    expect(jenkins.targetBranch).toBe("main");
    expect(jenkins.pullRequest).toEqual({
      id: "15",
      url: "https://github.com/myorg/myrepo/pull/15",
      title: "Fix things",
    });
  });

  it("omits Jenkins git fields for unsupported host", () => {
    mockEnv({
      GIT_URL: "https://dev.azure.com/org/project/_git/repo",
    });

    expect(jenkins.provider).toBeUndefined();
    expect(jenkins.repository).toBeUndefined();
  });

  it("maps local origin remote to supported git provider fields", () => {
    (spawnSync as Mock).mockImplementation((_command: string, args: string[]) => {
      if (args[0] === "remote") {
        return {
          error: undefined,
          stdout: Buffer.from("git@github.com:myorg/myrepo.git\n"),
        };
      }

      return {
        error: undefined,
        stdout: Buffer.from("main\n"),
      };
    });

    expect(local.provider).toBe(GitProvider.Github);
    expect(local.repository).toEqual({
      slug: "myorg/myrepo",
      url: "https://github.com/myorg/myrepo",
    });
    expect(local.sourceBranch).toBe("main");
  });
});
