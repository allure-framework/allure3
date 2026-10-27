import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { type CiDescriptor, CiType, GitProvider } from "@allurereport/core-api";
import type { PluginSummary } from "@allurereport/plugin-api";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { amazon } from "../src/detectors/amazon.js";
import { azure } from "../src/detectors/azure.js";
import { bitbucket } from "../src/detectors/bitbucket.js";
import { circle } from "../src/detectors/circle.js";
import { drone } from "../src/detectors/drone.js";
import { github } from "../src/detectors/github.js";
import { gitlab } from "../src/detectors/gitlab.js";
import { jenkins } from "../src/detectors/jenkins.js";
import { local } from "../src/detectors/local.js";
import { resolveGithubCommitSha } from "../src/helpers/github.js";
import { createReportCiContext } from "../src/helpers/reportCiContext.js";
import { createReportContextFromData } from "../src/reportContext.js";
import { renderReportSummaryMarkdown } from "../src/reportMarkdown.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({ getEnv: vi.fn() }));
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

const sha = "1234567890abcdef1234567890abcdef12345678";
const report: PluginSummary = {
  name: "Report",
  href: "https://reports.example.com",
  stats: { total: 0 },
  status: "passed",
  duration: 0,
};
const reportLine = '**Reports:** <a href="https://reports.example.com">Report</a>';
const render = (ci: CiDescriptor) => {
  const savedReport = JSON.parse(JSON.stringify({ ...report, ...createReportCiContext(ci) })) as PluginSummary;

  return renderReportSummaryMarkdown(createReportContextFromData({ reports: [savedReport] }));
};
const mockEnv = (env: Record<string, string>) => vi.mocked(getEnv).mockImplementation((key) => env[key] ?? "");

beforeEach(() => {
  vi.resetAllMocks();
  mockEnv({});
});

describe("CI report context", () => {
  it("captures absent CI metadata without context fields", () => {
    const saved = createReportCiContext(undefined);

    expect(saved).toEqual({ commitSha: undefined, commitHref: undefined, ciRunHref: undefined, ciRunName: undefined });
  });

  it.each([
    {
      ci: github,
      env: {
        GITHUB_SHA: sha,
        GITHUB_SERVER_URL: "https://github.example.com",
        GITHUB_REPOSITORY: "org/repo",
        GITHUB_RUN_ID: "42",
        GITHUB_RUN_NUMBER: "7",
        GITHUB_WORKFLOW: "CI",
        GITHUB_JOB: "publish-report",
      },
      commit: `https://github.example.com/org/repo/commit/${sha}`,
      run: "https://github.example.com/org/repo/actions/runs/42",
      name: "CI",
    },
    {
      ci: gitlab,
      env: {
        CI_COMMIT_SHA: sha,
        CI_PROJECT_PATH: "org/sub/repo",
        CI_PROJECT_URL: "https://gitlab.example.com/org/sub/repo/",
        CI_PIPELINE_URL: "https://gitlab.example.com/org/sub/repo/-/pipelines/42",
        CI_PIPELINE_ID: "42",
        CI_PIPELINE_NAME: "All tests",
        CI_JOB_NAME: "publish-report",
        CI_JOB_URL: "https://gitlab.example.com/org/sub/repo/-/jobs/99",
      },
      commit: `https://gitlab.example.com/org/sub/repo/-/commit/${sha}`,
      run: "https://gitlab.example.com/org/sub/repo/-/pipelines/42",
      name: "All tests",
    },
    {
      ci: bitbucket,
      env: {
        BITBUCKET_COMMIT: sha,
        BITBUCKET_REPO_FULL_NAME: "org/repo",
        BITBUCKET_GIT_HTTP_ORIGIN: "https://user:secret@bitbucket.org/org/repo.git",
        BITBUCKET_PIPELINE_UUID: "{42}",
        BITBUCKET_BUILD_NUMBER: "7",
      },
      commit: `https://bitbucket.org/org/repo/commits/${sha}`,
      run: "https://bitbucket.org/org/repo/pipelines/results/7",
      name: "7",
    },
    {
      ci: circle,
      env: {
        CIRCLE_SHA1: sha,
        CIRCLE_REPOSITORY_URL: "git@github.com:org/repo.git",
        CIRCLE_BUILD_URL: "https://circleci.com/gh/org/repo/42",
        CIRCLE_BUILD_NUM: "42",
        CIRCLE_WORKFLOW_ID: "workflow-id",
      },
      commit: `https://github.com/org/repo/commit/${sha}`,
      run: "https://app.circleci.com/pipelines/workflows/workflow-id",
      name: "workflow-id",
    },
    {
      ci: drone,
      env: {
        DRONE_COMMIT_SHA: sha,
        DRONE_REPO_LINK: "https://gitlab.example.com/org/repo",
        DRONE_BUILD_LINK: "https://drone.example.com/org/repo/42",
        DRONE_BUILD_NUMBER: "42",
      },
      commit: `https://gitlab.example.com/org/repo/-/commit/${sha}`,
      run: "https://drone.example.com/org/repo/42",
      name: "42",
    },
    {
      ci: jenkins,
      env: {
        GIT_COMMIT: sha,
        GIT_URL: "https://github.com/org/repo.git",
        BUILD_URL: "https://jenkins.example.com/job/tests/42/",
        BUILD_DISPLAY_NAME: "#42",
      },
      commit: `https://github.com/org/repo/commit/${sha}`,
      run: "https://jenkins.example.com/job/tests/42/",
      name: "#42",
    },
    {
      ci: azure,
      env: {
        BUILD_SOURCEVERSION: sha,
        BUILD_REPOSITORY_PROVIDER: "TfsGit",
        BUILD_REPOSITORY_URI: "https://user@dev.azure.com/org/project/_git/repo",
        SYSTEM_COLLECTIONURI: "https://dev.azure.com/org/",
        SYSTEM_TEAMPROJECTID: "project",
        BUILD_BUILDID: "42",
        BUILD_BUILDNUMBER: "build-42",
        BUILD_DEFINITIONNAME: "All tests",
      },
      commit: `https://dev.azure.com/org/project/_git/repo/commit/${sha}`,
      run: "https://dev.azure.com/org/project/_build/results?buildId=42",
      name: "All tests",
    },
    {
      ci: amazon,
      env: {
        CODEBUILD_RESOLVED_SOURCE_VERSION: sha,
        CODEBUILD_SOURCE_REPO_URL: "https://github.com/org/repo.git",
        CODEBUILD_BUILD_ARN:
          "arn:aws:codebuild:eu-west-1:123456789012:build/project:11111111-2222-3333-4444-555555555555",
        CODEBUILD_BUILD_NUMBER: "42",
      },
      commit: `https://github.com/org/repo/commit/${sha}`,
      run: "https://console.aws.amazon.com/codebuild/home?region=eu-west-1#/builds/project:11111111-2222-3333-4444-555555555555/view/new",
      name: "project-42",
    },
  ])("renders commit and run links for $ci.type", ({ ci, env, commit, run, name }) => {
    mockEnv(env);

    const markdown = render(ci);

    expect(markdown).toContain(
      `${reportLine}\n\n**Context:** <a href="${commit}">${sha.slice(0, 8)}</a>, <a href="${run}">${name}</a>`,
    );
  });

  it.each([
    { ci: github, env: { GITHUB_RUN_ID: "42" }, name: "42" },
    { ci: azure, env: { BUILD_BUILDID: "42", BUILD_BUILDNUMBER: "build-42" }, name: "build-42" },
    { ci: azure, env: { BUILD_BUILDID: "42" }, name: "42" },
  ])("uses available pipeline run identifiers when $ci.type has no pipeline name ($name)", ({ ci, env, name }) => {
    mockEnv(env);

    const pipelineName = ci.pipelineRunName;

    expect(pipelineName).toBe(name);
  });

  it.each([bitbucket, circle, drone])("omits unavailable pipeline metadata for $type", (ci) => {
    const pipelineUrl = ci.pipelineRunUrl;

    expect(pipelineUrl).toBeUndefined();
  });

  it("uses the Bitbucket pipeline UUID when no build number is available", () => {
    mockEnv({ BITBUCKET_PIPELINE_UUID: "{42}" });

    const pipelineName = bitbucket.pipelineRunName;

    expect(pipelineName).toBe("{42}");
  });

  it("links to the parent CodePipeline when it initiates the build", () => {
    mockEnv({
      CODEBUILD_INITIATOR: "codepipeline/tests",
      CODEBUILD_BUILD_ARN:
        "arn:aws:codebuild:eu-west-1:123456789012:build/project:11111111-2222-3333-4444-555555555555",
      CODEBUILD_BUILD_ID: "project:11111111-2222-3333-4444-555555555555",
      CODEBUILD_BUILD_URL:
        "https://eu-west-1.console.aws.amazon.com/codesuite/codebuild/123456789012/projects/project/build/project:11111111-2222-3333-4444-555555555555",
    });

    const markdown = render(amazon);

    expect(markdown).toContain(
      '<a href="https://console.aws.amazon.com/codesuite/codepipeline/pipelines/tests/view?region=eu-west-1">tests</a>',
    );
  });

  it.each([undefined, "javascript:alert(1)"])(
    "falls back to job metadata when no usable pipeline URL exists (%s)",
    (url) => {
      const ci = {
        ...jenkins,
        pipelineRunUrl: url,
        pipelineRunName: "Tests",
        jobRunUrl: "https://jenkins.example.com/job/publish-report/42",
        jobRunName: "publish-report #42",
      };

      const saved = JSON.parse(JSON.stringify(createReportCiContext(ci)));

      expect(saved).toMatchObject({
        ciRunHref: "https://jenkins.example.com/job/publish-report/42",
        ciRunName: "publish-report #42",
      });
    },
  );

  it("keeps a pipeline link paired with its label when only a job label is available", () => {
    const saved = createReportCiContext({
      ...jenkins,
      pipelineRunUrl: "https://ci.example.com/pipelines/42",
      jobRunUrl: "https://ci.example.com/jobs/publish-report/99",
      jobRunName: "publish-report",
    });

    expect(saved).toMatchObject({ ciRunHref: "https://ci.example.com/pipelines/42", ciRunName: "Pipeline" });
  });

  it.each([github, gitlab, bitbucket, circle, drone, jenkins, azure, amazon])(
    "omits unavailable commit metadata for $type",
    (ci) => {
      const commit = ci.commitSha;

      expect(commit).toBeUndefined();
    },
  );

  it.each([GitProvider.Github, GitProvider.Gitlab, GitProvider.Bitbucket])(
    "omits commits without a repository for %s",
    (provider) => {
      const markdown = render({ ...jenkins, commitSha: sha, provider });

      expect(markdown).toContain(`${reportLine}\n`);
    },
  );

  it.each(["javascript:alert(1)", "not-a-url"])("omits unusable context URLs (%s)", (url) => {
    const markdown = render({ ...jenkins, commitSha: sha, commitUrl: url, jobRunUrl: url });

    expect(markdown).toContain(`${reportLine}\n`);
  });

  it("strips credentials and uses the CI type when a run has no name or ID", () => {
    const markdown = render({
      ...jenkins,
      jobRunUrl: "http://user:secret@ci.example.com/run/42",
      jobRunName: "",
      jobRunUid: "",
    });

    expect(markdown).toContain(`${reportLine}\n\n**Context:** <a href="http://ci.example.com/run/42">jenkins</a>`);
  });

  it("uses the GitHub PR head SHA from the event even when merge refs resolve the PR number", () => {
    mockEnv({
      GITHUB_SHA: "merge",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "org/repo",
      GITHUB_REF_NAME: "7/merge",
      GITHUB_EVENT_PATH: "/event.json",
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ number: 7, pull_request: { head: { sha } } }));

    const markdown = render(github);

    expect(markdown).toContain(`<a href="https://github.com/org/repo/pull/7/commits/${sha}">${sha.slice(0, 8)}</a>`);
  });

  it("uses the workflow_run PR head SHA", () => {
    mockEnv({
      GITHUB_SHA: "downstream",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "org/repo",
      GITHUB_EVENT_PATH: "/event.json",
    });
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ workflow_run: { pull_requests: [{ number: 7, head: { sha } }] } }),
    );

    const markdown = render(github);

    expect(markdown).toContain(`/pull/7/commits/${sha}`);
  });

  it.each([[], [{ number: 7, head: { sha: "outdated-pr-head" } }]])(
    "uses workflow_run.head_sha when associated PRs are %j",
    (pullRequests) => {
      mockEnv({
        GITHUB_SHA: "downstream",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "org/repo",
        GITHUB_EVENT_PATH: "/event.json",
      });
      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify({ workflow_run: { head_sha: sha, pull_requests: pullRequests } }),
      );

      const commit = resolveGithubCommitSha();

      expect(commit).toBe(sha);
    },
  );

  it.each([false, true])("keeps distinct saved contexts beside their reports (filtered=%s)", (filtered) => {
    const reports = ["a", "b"].map((revision) => {
      mockEnv({
        CI_COMMIT_SHA: revision.repeat(40),
        CI_PROJECT_PATH: "org/repo",
        CI_PROJECT_URL: "https://gitlab.example.com/org/repo",
        CI_PIPELINE_URL: `https://gitlab.example.com/pipelines/${revision}`,
        CI_PIPELINE_ID: revision,
      });

      return {
        ...report,
        name: revision,
        href: `https://reports.example.com/${revision}`,
        filtered,
        ...createReportCiContext(gitlab),
      };
    });
    const saved = JSON.parse(JSON.stringify(reports)) as PluginSummary[];
    mockEnv({ CI_COMMIT_SHA: "publisher", CI_PIPELINE_URL: "https://gitlab.example.com/pipelines/publisher" });

    const markdown = renderReportSummaryMarkdown(
      createReportContextFromData({
        reports: [
          ...saved,
          { ...report, name: "Launch", pluginId: "testops", href: "https://testops.example.com", filtered },
        ],
      }),
    );

    for (const revision of ["a", "b"]) {
      expect(markdown).toContain(
        `* ${revision} - <a href="https://reports.example.com/${revision}">Report</a>, <a href="https://gitlab.example.com/org/repo/-/commit/${revision.repeat(40)}">${revision.repeat(8)}</a>, <a href="https://gitlab.example.com/pipelines/${revision}">${revision}</a>`,
      );
    }
    expect(markdown).not.toContain("publisher");
    expect(markdown).toContain('**Allure TestOps:** <a href="https://testops.example.com">Launch</a>');
  });

  it("groups reports with identical saved contexts under one context line", () => {
    const reports = ["a", "b"].map((name) => ({
      ...report,
      name,
      href: `https://reports.example.com/${name}`,
      commitSha: sha,
      commitHref: `https://github.com/org/repo/commit/${sha}`,
      ciRunName: "Tests",
      ciRunHref: "https://ci.example.com/pipelines/42",
    }));

    const markdown = renderReportSummaryMarkdown(createReportContextFromData({ reports }));

    expect(markdown).toContain(
      `**Reports:** <a href="https://reports.example.com/a">a</a>, <a href="https://reports.example.com/b">b</a>\n\n**Context:** <a href="https://github.com/org/repo/commit/${sha}">${sha.slice(0, 8)}</a>, <a href="https://ci.example.com/pipelines/42">Tests</a>`,
    );
  });

  it.each([
    { ciRunHref: undefined },
    { ciRunName: "Other tests" },
    { ciRunHref: "https://ci.example.com/pipelines/43" },
  ])("keeps different saved run contexts beside their reports (%j)", (overrides) => {
    const first = { ...report, name: "a", ciRunName: "Tests", ciRunHref: "https://ci.example.com/pipelines/42" };
    const second = { ...first, name: "b", ...overrides };

    const markdown = renderReportSummaryMarkdown(createReportContextFromData({ reports: [first, second] }));

    expect(markdown).toContain(
      '**Reports:**\n* a - <a href="https://reports.example.com">Report</a>, <a href="https://ci.example.com/pipelines/42">Tests</a>',
    );
    expect(markdown).toContain(
      `* b - <a href="https://reports.example.com">Report</a>${second.ciRunHref ? `, <a href="${second.ciRunHref}">${second.ciRunName}</a>` : ""}`,
    );
  });

  it("renders a saved CI run URL without a run label", () => {
    const context = createReportContextFromData({
      reports: [{ ...report, ciRunHref: "https://ci.example.com/run/42" }],
    });

    const markdown = renderReportSummaryMarkdown(context);

    expect(markdown).toContain(`${reportLine}\n\n**Context:** <a href="https://ci.example.com/run/42">CI run</a>`);
  });

  it("omits unsafe saved context links", () => {
    const context = createReportContextFromData({
      reports: [
        {
          ...report,
          commitSha: sha,
          commitHref: "javascript:alert(1)",
          ciRunHref: "javascript:alert(2)",
          ciRunName: "run",
        },
      ],
    });

    const markdown = renderReportSummaryMarkdown(context);

    expect(markdown).toContain(`${reportLine}\n`);
  });

  it("uses the GitLab MR head SHA and target project URL for fork pipelines", () => {
    mockEnv({
      CI_COMMIT_SHA: "merge",
      CI_MERGE_REQUEST_SOURCE_BRANCH_SHA: sha,
      CI_PROJECT_PATH: "fork/repo",
      CI_PROJECT_URL: "https://gitlab.example.com/fork/repo",
      CI_MERGE_REQUEST_IID: "7",
      CI_MERGE_REQUEST_PROJECT_URL: "https://gitlab.example.com/org/repo",
    });

    const markdown = render(gitlab);

    expect(markdown).toContain(
      `<a href="https://gitlab.example.com/org/repo/-/merge_requests/7/diffs?commit_id=${sha}">${sha.slice(0, 8)}</a>`,
    );
  });

  it("uses the Azure PR source commit for GitHub repositories", () => {
    mockEnv({
      SYSTEM_PULLREQUEST_SOURCECOMMITID: sha,
      BUILD_SOURCEVERSION: "merge",
      BUILD_REPOSITORY_PROVIDER: "GitHub",
      BUILD_REPOSITORY_URI: "https://github.com/org/repo",
      SYSTEM_PULLREQUEST_PULLREQUESTNUMBER: "7",
    });

    const markdown = render(azure);

    expect(markdown).toContain(`/pull/7/commits/${sha}`);
  });

  it.each([sha, "main", "pr/7", ""])("uses only a resolved CodeBuild commit or a SHA source version (%s)", (source) => {
    mockEnv({ CODEBUILD_SOURCE_VERSION: source, CODEBUILD_SOURCE_REPO_URL: "https://github.com/org/repo" });

    const commit = amazon.commitSha;

    expect(commit).toBe(source === sha ? sha : undefined);
  });

  it("renders the local git commit without a CI run link", () => {
    vi.mocked(spawnSync).mockImplementation(
      (_command, args) =>
        ({
          status: 0,
          stdout: Buffer.from(args?.[0] === "rev-parse" ? `${sha}\n` : "git@github.com:org/repo.git\n"),
        }) as ReturnType<typeof spawnSync>,
    );

    const markdown = render(local);

    expect(markdown).toContain(
      `${reportLine}\n\n**Context:** <a href="https://github.com/org/repo/commit/${sha}">${sha.slice(0, 8)}</a>\n`,
    );
  });

  it.each([
    { status: 128, stdout: Buffer.from("") },
    { status: 0, stdout: Buffer.from("") },
    { status: null, error: new Error("git not found") },
  ])("omits unavailable local commits (%j)", (output) => {
    vi.mocked(spawnSync).mockReturnValue(output as ReturnType<typeof spawnSync>);

    const commit = local.commitSha;

    expect(commit).toBeUndefined();
  });

  it("renders saved context below report links and before TestOps", () => {
    mockEnv({ CI_PIPELINE_URL: "https://gitlab.example.com/pipelines/42", CI_PIPELINE_ID: "42" });
    const context = createReportContextFromData({
      reports: [
        { ...report, ...createReportCiContext(gitlab) },
        {
          name: "Launch",
          pluginId: "testops",
          href: "https://testops.example.com",
          stats: { total: 0 },
          status: "passed",
          duration: 0,
        },
      ],
    });
    const markdown = renderReportSummaryMarkdown(context);

    expect(markdown).toContain(
      `${reportLine}\n\n**Context:** <a href="https://gitlab.example.com/pipelines/42">42</a>\n\n**Allure TestOps:**`,
    );
  });

  it("omits empty context and unknown commit providers", () => {
    const ci = {
      ...jenkins,
      type: CiType.Jenkins,
      commitSha: sha,
      provider: GitProvider.Other,
      repository: { slug: "org/repo", url: "https://unknown.example.com/org/repo" },
    };

    const markdown = render(ci);

    expect(markdown).toContain(`${reportLine}\n`);
  });

  it("escapes run names and URLs and falls back to the run ID", () => {
    const ci = { ...jenkins, jobRunUrl: 'https://ci.example.com/?a=1&b="2"', jobRunUid: "42", jobRunName: "" };
    const fallback = render(ci);
    const named = render({ ...ci, jobRunName: '<tests> & "run"' });

    expect(fallback).toContain(
      `${reportLine}\n\n**Context:** <a href="https://ci.example.com/?a=1&amp;b=&quot;2&quot;">42</a>`,
    );
    expect(named).toContain("&lt;tests&gt; &amp; &quot;run&quot;</a>");
  });
});
