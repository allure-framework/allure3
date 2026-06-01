import { detect } from "@allurereport/ci";
import { GitProvider, type CiDescriptor } from "@allurereport/core-api";
import { collectGitFacts, isGitAvailable } from "@allurereport/git";
import type { AllureStore, PluginContext } from "@allurereport/plugin-api";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestOpsPluginOptions } from "../../src/model.js";
import { TestOpsPlugin } from "../../src/plugin.js";
import { resolvePluginOptions } from "../../src/utils/index.js";
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

vi.mock("../../src/utils/index.js", async (importOriginal) => {
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
  type: "github",
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
    });

    await startPlugin({ gitFlow: true } as TestOpsPluginOptions);

    const gitContext = TestOpsClientMock.prototype.createLaunch.mock.calls[0][2];

    expect(gitContext).toMatchObject({
      contextType: "standalone",
      commit: { hash: commit },
    });
    expect(gitContext?.branch).toBeUndefined();
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
});
