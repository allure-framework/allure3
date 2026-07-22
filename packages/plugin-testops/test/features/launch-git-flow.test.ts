import { detect } from "@allurereport/ci";
import { CiType, GitProvider, type CiDescriptor } from "@allurereport/core-api";
import { collectGitFacts, isGitAvailable } from "@allurereport/git";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import { attachment, step } from "allure-js-commons";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestOpsPluginOptions } from "../../src/model.js";
import { TestOpsPlugin } from "../../src/plugin.js";
import { resolvePluginOptions } from "../../src/utils/options.js";
import { AllureStoreMock, TestOpsClientMock } from "../utils.js";

vi.mock("@allurereport/ci", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@allurereport/ci")>()),
  detect: vi.fn(),
}));

vi.mock("@allurereport/git", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@allurereport/git")>();

  return {
    ...actual,
    collectGitFacts: vi.fn(() => undefined),
    isGitAvailable: vi.fn(() => true),
  };
});

vi.mock("../../src/client.js", async () => {
  const utils = await import("../utils.js");

  return {
    TestOpsClient: utils.TestOpsClientMock,
  };
});

vi.mock("../../src/utils/options.js", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    resolvePluginOptions: vi.fn(),
  };
});

const fixtures = {
  accessToken: "test",
  endpoint: "http://example.com",
  projectId: "12345",
  launchName: "Allure Report",
  launchTags: ["t1"],
  attachmentContent: {
    asBuffer: async () => Buffer.from("test"),
  },
};

const githubCi = {
  type: CiType.Github,
  repoName: "myrepo",
  jobRunBranch: "feature",
  jobUid: "job",
  jobRunUid: "run-1",
  jobRunName: "build",
} as CiDescriptor;

const setupPluginOptions = () => {
  (resolvePluginOptions as Mock).mockReturnValue({
    accessToken: fixtures.accessToken,
    endpoint: fixtures.endpoint,
    projectId: fixtures.projectId,
    launchName: fixtures.launchName,
    launchTags: fixtures.launchTags,
  });
};

const startPlugin = async (pluginOptions: TestOpsPluginOptions) => {
  setupPluginOptions();
  const store = new AllureStoreMock() as unknown as AllureStore;
  AllureStoreMock.prototype.allTestResults.mockResolvedValue([]);
  AllureStoreMock.prototype.attachmentsByTrId.mockResolvedValue([]);
  AllureStoreMock.prototype.attachmentContentById.mockResolvedValue(fixtures.attachmentContent);
  AllureStoreMock.prototype.fixturesByTrId.mockResolvedValue([]);

  const plugin = new TestOpsPlugin(pluginOptions);
  await plugin.start({ reportUuid: "test-uuid" } as PluginContext, store);

  return plugin;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Launch git flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (detect as Mock).mockReturnValue(githubCi);
    vi.mocked(isGitAvailable).mockReturnValue(true);
  });

  it("does not collect git facts when gitFlow is disabled", async () => {
    await startPlugin({ gitFlow: false } as TestOpsPluginOptions);

    expect(collectGitFacts).not.toHaveBeenCalled();
    expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith(
      fixtures.launchName,
      fixtures.launchTags,
      undefined,
    );
  });

  it("does not attach git context when git CLI is unavailable", async () => {
    vi.mocked(isGitAvailable).mockReturnValue(false);

    await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

    expect(collectGitFacts).not.toHaveBeenCalled();
    expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith(
      fixtures.launchName,
      fixtures.launchTags,
      undefined,
    );
  });

  it("posts branch git context on createLaunch", async () => {
    const commit = "a".repeat(40);
    const parent = "b".repeat(40);

    (detect as Mock).mockReturnValue({
      ...githubCi,
      provider: GitProvider.Github,
      repository: { slug: "myorg/myrepo" },
      sourceBranch: "feature",
    });
    vi.mocked(collectGitFacts).mockReturnValue({
      commit,
      firstParentAncestors: [parent],
    });

    await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

    expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith(fixtures.launchName, fixtures.launchTags, {
      contextType: "branch",
      repository: {
        providerType: "github",
        name: "myorg/myrepo",
        url: "https://github.com/myorg/myrepo.git",
      },
      commit: {
        hash: commit,
        url: `https://github.com/myorg/myrepo/commit/${commit}`,
        lineage: [parent],
      },
      branch: {
        name: "feature",
        url: "https://github.com/myorg/myrepo/tree/feature",
      },
    });
  });

  it("does not send standalone metadata on branch context", async () => {
    const commit = "a".repeat(40);

    (detect as Mock).mockReturnValue({
      ...githubCi,
      provider: GitProvider.Github,
      repository: { slug: "myorg/myrepo" },
      sourceBranch: "feature",
    });
    vi.mocked(collectGitFacts).mockReturnValue({
      commit,
      firstParentAncestors: [],
      localState: {
        uncommittedChanges: true,
        unpublishedCommit: false,
        unpublishedBranch: false,
        detachedHead: false,
      },
    });

    await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

    expect(TestOpsClientMock.prototype.createLaunch.mock.calls[0][2]).toMatchObject({
      contextType: "branch",
      branch: { name: "feature" },
    });
    expect(TestOpsClientMock.prototype.createLaunch.mock.calls[0][2]?.metadata).toBeUndefined();
  });

  it("posts pull request git context with workflow metadata", async () => {
    const commit = "f".repeat(40);

    (detect as Mock).mockReturnValue({
      ...githubCi,
      jobRunUid: "run-42",
      jobRunName: "PR CI Build",
      provider: GitProvider.Github,
      repository: { slug: "myorg/myrepo", url: "https://github.com/myorg/myrepo" },
      sourceBranch: "feature/x",
      targetBranch: "main",
      pullRequest: { id: "7", title: "Fix things", url: "https://github.com/myorg/myrepo/pull/7" },
    });
    vi.mocked(collectGitFacts).mockReturnValue({
      commit,
      firstParentAncestors: ["a".repeat(40)],
    });

    await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

    expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith(
      fixtures.launchName,
      fixtures.launchTags,
      expect.any(Object),
    );

    expect(TestOpsClientMock.prototype.createLaunch.mock.calls[0][2]).toMatchObject({
      contextType: "pull_request",
      metadata: {
        workflowRunId: "run-42",
        workflowRunName: "PR CI Build",
      },
      pullRequest: {
        externalId: "7",
        title: "Fix things",
        sourceBranch: { name: "feature/x" },
        targetBranch: { name: "main" },
      },
    });
  });

  it("omits git context when pull request branches are incomplete", async () => {
    (detect as Mock).mockReturnValue({
      ...githubCi,
      provider: GitProvider.Github,
      repository: { slug: "org/repo" },
      sourceBranch: "feature",
      pullRequest: { id: "9" },
    });
    vi.mocked(collectGitFacts).mockReturnValue({
      commit: "c".repeat(40),
      firstParentAncestors: [],
    });

    await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

    expect(TestOpsClientMock.prototype.createLaunch).toHaveBeenCalledWith(
      fixtures.launchName,
      fixtures.launchTags,
      undefined,
    );
  });

  it("posts standalone git context when branch and pull request are absent", async () => {
    const commit = "c".repeat(40);

    (detect as Mock).mockReturnValue({
      type: "github",
      repoName: "myrepo",
      jobRunBranch: "",
      provider: GitProvider.Github,
      repository: { slug: "org/repo", url: "https://github.com/org/repo" },
    });
    vi.mocked(collectGitFacts).mockReturnValue({
      commit,
      firstParentAncestors: [],
      localState: {
        uncommittedChanges: true,
        unpublishedCommit: false,
        unpublishedBranch: true,
        detachedHead: true,
      },
    });

    await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

    const gitContext = TestOpsClientMock.prototype.createLaunch.mock.calls[0][2];

    expect(gitContext).toMatchObject({
      contextType: "standalone",
      commit: { hash: commit },
      metadata: {
        hasUncommittedChanges: true,
        isUnpublishedCommit: false,
        isUnpublishedBranch: true,
      },
    });
    expect(gitContext?.branch).toBeUndefined();
  });

  it("falls back to git facts branch when CI source branch is blank", async () => {
    const commit = "d".repeat(40);

    (detect as Mock).mockReturnValue({
      ...githubCi,
      provider: GitProvider.Github,
      repository: { slug: "myorg/myrepo" },
      sourceBranch: "",
      jobRunBranch: "",
    });
    vi.mocked(collectGitFacts).mockReturnValue({
      commit,
      branch: "feature/from-git",
      firstParentAncestors: [],
    });

    await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

    expect(TestOpsClientMock.prototype.createLaunch.mock.calls[0][2]).toMatchObject({
      contextType: "branch",
      branch: { name: "feature/from-git" },
    });
  });

  it("infers gitlab provider from repository url", async () => {
    const commit = "c".repeat(40);

    (detect as Mock).mockReturnValue({
      ...githubCi,
      repository: { slug: "org/repo", url: "https://gitlab.com/org/repo" },
      sourceBranch: "develop",
    });
    vi.mocked(collectGitFacts).mockReturnValue({
      commit,
      firstParentAncestors: [],
    });

    await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

    expect(TestOpsClientMock.prototype.createLaunch.mock.calls[0][2]?.repository.providerType).toBe("gitlab");
  });

  it.each([
    {
      name: "Amazon CodeBuild",
      ci: {
        ...githubCi,
        type: CiType.Amazon,
        provider: undefined,
        repository: { slug: "org/amazon-repo", url: "https://github.com/org/amazon-repo" },
        sourceBranch: "feature/amazon",
        targetBranch: "main",
        pullRequest: { id: "11", url: "https://github.com/org/amazon-repo/pull/11", title: "Amazon PR" },
      },
      expectedProviderType: "github",
      expectedContextType: "pull_request",
    },
    {
      name: "Azure Pipelines",
      ci: {
        ...githubCi,
        type: CiType.Azure,
        provider: GitProvider.Github,
        repository: { slug: "org/azure-repo", url: "https://github.com/org/azure-repo" },
        sourceBranch: "feature/azure",
        targetBranch: "main",
        pullRequest: { id: "12", url: "https://github.com/org/azure-repo/pull/12", title: "Azure PR" },
      },
      expectedProviderType: "github",
      expectedContextType: "pull_request",
    },
    {
      name: "Bitbucket Pipelines",
      ci: {
        ...githubCi,
        type: CiType.Bitbucket,
        provider: GitProvider.Bitbucket,
        repository: { slug: "org/bitbucket-repo", url: "https://bitbucket.org/org/bitbucket-repo" },
        sourceBranch: "feature/bitbucket",
        targetBranch: "main",
        pullRequest: {
          id: "13",
          url: "https://bitbucket.org/org/bitbucket-repo/pull-requests/13",
          title: "Bitbucket PR",
        },
      },
      expectedProviderType: "bitbucket",
      expectedContextType: "pull_request",
    },
    {
      name: "CircleCI",
      ci: {
        ...githubCi,
        type: CiType.Circle,
        provider: undefined,
        repository: { slug: "org/circle-repo", url: "https://github.com/org/circle-repo" },
        sourceBranch: "feature/circle",
      },
      expectedProviderType: "github",
      expectedContextType: "branch",
    },
    {
      name: "Drone",
      ci: {
        ...githubCi,
        type: CiType.Drone,
        provider: GitProvider.Gitlab,
        repository: { slug: "org/drone-repo", url: "https://gitlab.com/org/drone-repo" },
        sourceBranch: "feature/drone",
        targetBranch: "main",
        pullRequest: {
          id: "14",
          url: "https://gitlab.com/org/drone-repo/-/merge_requests/14",
          title: "Drone MR",
        },
      },
      expectedProviderType: "gitlab",
      expectedContextType: "pull_request",
    },
    {
      name: "GitHub Actions",
      ci: {
        ...githubCi,
        type: CiType.Github,
        provider: GitProvider.Github,
        repository: { slug: "org/github-repo", url: "https://github.com/org/github-repo" },
        sourceBranch: "feature/github",
        targetBranch: "main",
        pullRequest: { id: "15", url: "https://github.com/org/github-repo/pull/15", title: "GitHub PR" },
      },
      expectedProviderType: "github",
      expectedContextType: "pull_request",
    },
    {
      name: "GitLab CI/CD",
      ci: {
        ...githubCi,
        type: CiType.Gitlab,
        provider: GitProvider.Gitlab,
        repository: { slug: "org/gitlab-repo", url: "https://gitlab.com/org/gitlab-repo" },
        sourceBranch: "feature/gitlab",
        targetBranch: "main",
        pullRequest: {
          id: "16",
          url: "https://gitlab.com/org/gitlab-repo/-/merge_requests/16",
          title: "GitLab MR",
        },
      },
      expectedProviderType: "gitlab",
      expectedContextType: "pull_request",
    },
    {
      name: "Jenkins",
      ci: {
        ...githubCi,
        type: CiType.Jenkins,
        provider: undefined,
        repository: { slug: "org/jenkins-repo", url: "https://github.com/org/jenkins-repo" },
        sourceBranch: "feature/jenkins",
        targetBranch: "main",
        pullRequest: { id: "17", url: "https://github.com/org/jenkins-repo/pull/17", title: "Jenkins PR" },
      },
      expectedProviderType: "github",
      expectedContextType: "pull_request",
    },
  ] as const)("projects TestOps git context for $name", async ({ ci, expectedProviderType, expectedContextType }) => {
    const commit = "e".repeat(40);
    const ciDescriptor = ci as CiDescriptor;

    (detect as Mock).mockReturnValue(ciDescriptor);
    vi.mocked(collectGitFacts).mockReturnValue({
      commit,
      firstParentAncestors: ["f".repeat(40)],
    });

    const gitContext = await step(`project ${ciDescriptor.type} CI descriptor to TestOps git context`, async () => {
      await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

      const projected = TestOpsClientMock.prototype.createLaunch.mock.calls[0][2];

      await attachment(
        "projected git context",
        JSON.stringify({ ci: ciDescriptor, gitContext: projected }, null, 2),
        "application/json",
      );

      return projected;
    });

    await step("verify TestOps launch git context DTO shape", async () => {
      expect(gitContext).toMatchObject({
        contextType: expectedContextType,
        repository: { providerType: expectedProviderType },
        commit: { hash: commit, lineage: ["f".repeat(40)] },
      });

      if (expectedContextType === "pull_request") {
        expect(gitContext?.pullRequest).toMatchObject({
          externalId: ciDescriptor.pullRequest?.id,
          sourceBranch: { name: ciDescriptor.sourceBranch },
          targetBranch: { name: ciDescriptor.targetBranch },
        });
      } else {
        expect(gitContext?.branch).toMatchObject({ name: ciDescriptor.sourceBranch });
        expect(gitContext?.pullRequest).toBeUndefined();
      }
    });
  });
});
