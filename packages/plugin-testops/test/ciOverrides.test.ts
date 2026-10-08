import type { CiDescriptor, GitFacts } from "@allurereport/core-api";
import { GitProvider } from "@allurereport/core-api";
import { epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyCiOverrides, applyGitFactsOverrides } from "../src/utils/ciOverrides.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("testops-integration");
  await story("ciOverrides");
  await label("coverage", "testops-integration");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const baseCi = {
  type: "github",
  jobUid: "detected-job-uid",
  jobUrl: "https://ci.example.com/job",
  jobName: "detected-job-name",
  jobRunUid: "detected-run-uid",
  jobRunUrl: "https://ci.example.com/job/run",
  jobRunName: "detected-run-name",
  jobRunBranch: "detected-branch",
  repoName: "detected-repo",
} as unknown as CiDescriptor;

const baseFacts = {
  commit: "a".repeat(40),
  branch: "feature/local",
  firstParentAncestors: ["b".repeat(40), "c".repeat(40)],
} satisfies GitFacts;

describe("applyCiOverrides", () => {
  it("returns the descriptor unchanged when no override env vars are set", () => {
    expect(applyCiOverrides(baseCi)).toEqual(baseCi);
  });

  it("overrides jobUid from ALLURE_JOB_UID", () => {
    vi.stubEnv("ALLURE_JOB_UID", "manual-job-uid");

    expect(applyCiOverrides(baseCi)).toEqual({ ...baseCi, jobUid: "manual-job-uid" });
  });

  it("overrides every supported field independently", () => {
    vi.stubEnv("ALLURE_JOB_UID", "manual-job-uid");
    vi.stubEnv("ALLURE_JOB_URL", "https://manual.example.com/job");
    vi.stubEnv("ALLURE_JOB_NAME", "manual-job-name");
    vi.stubEnv("ALLURE_JOB_RUN_UID", "manual-run-uid");
    vi.stubEnv("ALLURE_JOB_RUN_URL", "https://manual.example.com/run");
    vi.stubEnv("ALLURE_JOB_RUN_NAME", "manual-run-name");
    vi.stubEnv("ALLURE_JOB_RUN_BRANCH", "manual-branch");

    expect(applyCiOverrides(baseCi)).toEqual({
      ...baseCi,
      jobUid: "manual-job-uid",
      jobUrl: "https://manual.example.com/job",
      jobName: "manual-job-name",
      jobRunUid: "manual-run-uid",
      jobRunUrl: "https://manual.example.com/run",
      jobRunName: "manual-run-name",
      jobRunBranch: "manual-branch",
    });
  });

  it("leaves fields without a matching env var untouched", () => {
    vi.stubEnv("ALLURE_JOB_NAME", "manual-job-name");

    const result = applyCiOverrides(baseCi);

    expect(result.jobName).toBe("manual-job-name");
    expect(result.jobUid).toBe(baseCi.jobUid);
    expect(result.jobRunUid).toBe(baseCi.jobRunUid);
  });

  it("ignores empty-string overrides", () => {
    vi.stubEnv("ALLURE_JOB_UID", "");

    expect(applyCiOverrides(baseCi)).toEqual(baseCi);
  });

  it("overrides source and target branches", () => {
    vi.stubEnv("ALLURE_CI_SOURCE_BRANCH", "feature/foo");
    vi.stubEnv("ALLURE_CI_TARGET_BRANCH", "main");

    expect(applyCiOverrides(baseCi)).toEqual({
      ...baseCi,
      sourceBranch: "feature/foo",
      targetBranch: "main",
    });
  });

  it("overrides pull request metadata", () => {
    vi.stubEnv("ALLURE_CI_PULL_REQUEST_ID", "920");
    vi.stubEnv("ALLURE_CI_PULL_REQUEST_URL", "https://github.com/org/repo/pull/920");
    vi.stubEnv("ALLURE_CI_PULL_REQUEST_TITLE", "Pull request #920");

    expect(applyCiOverrides(baseCi)).toEqual({
      ...baseCi,
      pullRequestName: "Pull request #920",
      pullRequestUrl: "https://github.com/org/repo/pull/920",
      pullRequest: {
        id: "920",
        url: "https://github.com/org/repo/pull/920",
        title: "Pull request #920",
      },
    });
  });

  it("keeps existing pull request fields when only the id is overridden", () => {
    const withPullRequest = {
      ...baseCi,
      pullRequest: {
        id: "1",
        url: "https://github.com/org/repo/pull/1",
        title: "Old title",
      },
    } as unknown as CiDescriptor;

    vi.stubEnv("ALLURE_CI_PULL_REQUEST_ID", "920");

    expect(applyCiOverrides(withPullRequest)).toEqual({
      ...withPullRequest,
      pullRequest: {
        id: "920",
        url: "https://github.com/org/repo/pull/1",
        title: "Old title",
      },
    });
  });

  it("keeps existing pullRequest id/title when only the URL is overridden", () => {
    const withPullRequest = {
      ...baseCi,
      pullRequest: {
        id: "1",
        url: "https://github.com/org/repo/pull/1",
        title: "Old title",
      },
    } as unknown as CiDescriptor;

    vi.stubEnv("ALLURE_CI_PULL_REQUEST_URL", "https://github.com/org/repo/pull/1?updated=1");

    expect(applyCiOverrides(withPullRequest)).toEqual({
      ...withPullRequest,
      pullRequestUrl: "https://github.com/org/repo/pull/1?updated=1",
      pullRequest: {
        id: "1",
        url: "https://github.com/org/repo/pull/1?updated=1",
        title: "Old title",
      },
    });
  });

  it("does not create pullRequest when only the URL is overridden and no id exists", () => {
    vi.stubEnv("ALLURE_CI_PULL_REQUEST_URL", "https://github.com/org/repo/pull/920");

    expect(applyCiOverrides(baseCi)).toEqual({
      ...baseCi,
      pullRequestUrl: "https://github.com/org/repo/pull/920",
    });
    expect(applyCiOverrides(baseCi).pullRequest).toBeUndefined();
  });

  it("overrides repository.slug via ALLURE_CI_REPOSITORY_SLUG while keeping existing repository.url", () => {
    const withRepository = {
      ...baseCi,
      repository: {
        slug: "old-org/old-repo",
        url: "https://github.com/old-org/old-repo",
      },
    } as unknown as CiDescriptor;

    vi.stubEnv("ALLURE_CI_REPOSITORY_SLUG", "org/repo");

    expect(applyCiOverrides(withRepository)).toEqual({
      ...withRepository,
      repository: {
        slug: "org/repo",
        url: "https://github.com/old-org/old-repo",
      },
    });
  });

  it("overrides repoName alone without changing repository.slug", () => {
    const withRepository = {
      ...baseCi,
      repository: {
        slug: "old-org/old-repo",
        url: "https://github.com/old-org/old-repo",
      },
    } as unknown as CiDescriptor;

    vi.stubEnv("ALLURE_CI_REPO_NAME", "short-repo");

    expect(applyCiOverrides(withRepository)).toEqual({
      ...withRepository,
      repoName: "short-repo",
    });
  });

  it("overrides repository.url and keeps existing slug when slug override is unset", () => {
    const withRepository = {
      ...baseCi,
      repository: {
        slug: "org/repo",
        url: "https://github.com/org/repo",
      },
    } as unknown as CiDescriptor;

    vi.stubEnv("ALLURE_CI_REPOSITORY_URL", "https://github.com/org/repo.git");

    expect(applyCiOverrides(withRepository)).toEqual({
      ...withRepository,
      repository: {
        slug: "org/repo",
        url: "https://github.com/org/repo.git",
      },
    });
  });

  it("does not create a repository object when only the URL is overridden and no slug exists", () => {
    vi.stubEnv("ALLURE_CI_REPOSITORY_URL", "https://github.com/org/repo");

    expect(applyCiOverrides(baseCi)).toEqual(baseCi);
    expect(applyCiOverrides(baseCi).repository).toBeUndefined();
  });

  it("overrides provider with a case-insensitive GitProvider value", () => {
    vi.stubEnv("ALLURE_CI_GIT_PROVIDER", "GiTHuB");

    expect(applyCiOverrides(baseCi)).toEqual({
      ...baseCi,
      provider: GitProvider.Github,
    });
  });

  it("ignores invalid git provider overrides", () => {
    vi.stubEnv("ALLURE_CI_GIT_PROVIDER", "svn");

    expect(applyCiOverrides(baseCi)).toEqual(baseCi);
  });
});

describe("applyGitFactsOverrides", () => {
  it("returns facts unchanged when no git override env vars are set", () => {
    expect(applyGitFactsOverrides(baseFacts)).toEqual(baseFacts);
  });

  it("overrides commit and keeps ancestors when the commit is unchanged", () => {
    vi.stubEnv("ALLURE_CI_COMMIT", baseFacts.commit);

    expect(applyGitFactsOverrides(baseFacts)).toEqual(baseFacts);
  });

  it("overrides commit alone and clears stale ancestors", () => {
    const commit = "d".repeat(40);

    vi.stubEnv("ALLURE_CI_COMMIT", commit);

    expect(applyGitFactsOverrides(baseFacts)).toEqual({
      ...baseFacts,
      commit,
      firstParentAncestors: [],
    });
  });

  it("overrides commit and ancestors together", () => {
    const commit = "d".repeat(40);
    const parent = "e".repeat(40);

    vi.stubEnv("ALLURE_CI_COMMIT", commit);
    vi.stubEnv("ALLURE_CI_FIRST_PARENT_ANCESTORS", `${parent}, ${"f".repeat(40)}`);

    expect(applyGitFactsOverrides(baseFacts)).toEqual({
      ...baseFacts,
      commit,
      firstParentAncestors: [parent, "f".repeat(40)],
    });
  });

  it("synthesizes minimal facts when commit is set and no collected facts exist", () => {
    const commit = "d".repeat(40);

    vi.stubEnv("ALLURE_CI_COMMIT", commit);

    expect(applyGitFactsOverrides(undefined)).toEqual({
      commit,
      firstParentAncestors: [],
      branch: undefined,
    });
  });

  it("synthesizes facts with ancestors when commit and ancestors are set without collected facts", () => {
    const commit = "d".repeat(40);
    const parent = "e".repeat(40);

    vi.stubEnv("ALLURE_CI_COMMIT", commit);
    vi.stubEnv("ALLURE_CI_FIRST_PARENT_ANCESTORS", parent);

    expect(applyGitFactsOverrides(undefined)).toEqual({
      commit,
      firstParentAncestors: [parent],
      branch: undefined,
    });
  });

  it("applies ancestors-only override to existing facts", () => {
    const parent = "e".repeat(40);

    vi.stubEnv("ALLURE_CI_FIRST_PARENT_ANCESTORS", parent);

    expect(applyGitFactsOverrides(baseFacts)).toEqual({
      ...baseFacts,
      firstParentAncestors: [parent],
    });
  });

  it("ignores ancestors-only override when no facts exist", () => {
    vi.stubEnv("ALLURE_CI_FIRST_PARENT_ANCESTORS", "e".repeat(40));

    expect(applyGitFactsOverrides(undefined)).toBeUndefined();
  });
});
