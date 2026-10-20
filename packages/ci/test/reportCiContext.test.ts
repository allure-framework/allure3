import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { type CiDescriptor, CiType, GitProvider } from "@allurereport/core-api";
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
import { createReportContextFromData } from "../src/reportContext.js";
import { renderReportSummaryMarkdown } from "../src/reportMarkdown.js";
import { getEnv } from "../src/utils.js";

vi.mock("../src/utils.js", () => ({ getEnv: vi.fn() }));
vi.mock("node:fs", () => ({ readFileSync: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

const sha = "1234567890abcdef1234567890abcdef12345678";
const summary = createReportContextFromData({ reports: [] });
const render = (ci: CiDescriptor) => renderReportSummaryMarkdown(summary, { ci });
const mockEnv = (env: Record<string, string>) => vi.mocked(getEnv).mockImplementation((key) => env[key] ?? "");

beforeEach(() => {
  vi.resetAllMocks();
  mockEnv({});
});

describe("CI report context", () => {
  it.each([
    {
      ci: github,
      env: {
        GITHUB_SHA: sha,
        GITHUB_SERVER_URL: "https://github.example.com",
        GITHUB_REPOSITORY: "org/repo",
        GITHUB_RUN_ID: "42",
        GITHUB_RUN_NUMBER: "7",
        GITHUB_JOB: "tests",
      },
      commit: `https://github.example.com/org/repo/commit/${sha}`,
      run: "https://github.example.com/org/repo/actions/runs/42",
      name: "tests #7",
    },
    {
      ci: gitlab,
      env: {
        CI_COMMIT_SHA: sha,
        CI_PROJECT_PATH: "org/sub/repo",
        CI_PROJECT_URL: "https://gitlab.example.com/org/sub/repo",
        CI_PIPELINE_URL: "https://gitlab.example.com/org/sub/repo/-/pipelines/42",
        CI_PIPELINE_ID: "42",
      },
      commit: `https://gitlab.example.com/org/sub/repo/-/commit/${sha}`,
      run: "https://gitlab.example.com/org/sub/repo/-/pipelines/42",
      name: "42",
    },
    {
      ci: bitbucket,
      env: {
        BITBUCKET_COMMIT: sha,
        BITBUCKET_REPO_FULL_NAME: "org/repo",
        BITBUCKET_GIT_HTTP_ORIGIN: "https://user:secret@bitbucket.org/org/repo.git",
        BITBUCKET_PIPELINE_UUID: "{42}",
      },
      commit: `https://bitbucket.org/org/repo/commits/${sha}`,
      run: "https://bitbucket.org/org/repo/pipelines/results/{42}",
      name: "{42}",
    },
    {
      ci: circle,
      env: {
        CIRCLE_SHA1: sha,
        CIRCLE_REPOSITORY_URL: "git@github.com:org/repo.git",
        CIRCLE_BUILD_URL: "https://circleci.com/gh/org/repo/42",
        CIRCLE_BUILD_NUM: "42",
      },
      commit: `https://github.com/org/repo/commit/${sha}`,
      run: "https://circleci.com/gh/org/repo/42",
      name: "42",
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
      },
      commit: `https://dev.azure.com/org/project/_git/repo/commit/${sha}`,
      run: "https://dev.azure.com/org/project/_build/results?buildId=42",
      name: "build-42",
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

    expect(markdown).toContain(`**Context:** <a href="${commit}">${sha.slice(0, 8)}</a>, <a href="${run}">${name}</a>`);
  });

  it("links to the CodeBuild run when CodePipeline initiates the build", () => {
    mockEnv({
      CODEBUILD_INITIATOR: "codepipeline/tests",
      CODEBUILD_BUILD_ID: "project:11111111-2222-3333-4444-555555555555",
      CODEBUILD_BUILD_URL:
        "https://eu-west-1.console.aws.amazon.com/codesuite/codebuild/123456789012/projects/project/build/project:11111111-2222-3333-4444-555555555555",
    });

    const markdown = render(amazon);

    expect(markdown).toContain(
      'href="https://eu-west-1.console.aws.amazon.com/codesuite/codebuild/123456789012/projects/project/build/project:11111111-2222-3333-4444-555555555555"',
    );
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

      expect(markdown).not.toContain("**Context:**");
    },
  );

  it.each(["javascript:alert(1)", "not-a-url"])("omits unusable context URLs (%s)", (url) => {
    const markdown = render({ ...jenkins, commitSha: sha, commitUrl: url, jobRunUrl: url });

    expect(markdown).not.toContain("**Context:**");
  });

  it("strips credentials and uses the CI type when a run has no name or ID", () => {
    const markdown = render({
      ...jenkins,
      jobRunUrl: "http://user:secret@ci.example.com/run/42",
      jobRunName: "",
      jobRunUid: "",
    });

    expect(markdown).toContain('**Context:** <a href="http://ci.example.com/run/42">jenkins</a>');
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
      `**Context:** <a href="https://github.com/org/repo/commit/${sha}">${sha.slice(0, 8)}</a>\n`,
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

  it("places context immediately below Reports and before TestOps", () => {
    const context = createReportContextFromData({
      reports: [
        { name: "Report", href: "https://reports.example.com", stats: { total: 0 }, status: "passed", duration: 0 },
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
    mockEnv({ CI_PIPELINE_URL: "https://gitlab.example.com/pipelines/42", CI_PIPELINE_ID: "42" });

    const markdown = renderReportSummaryMarkdown(context, { ci: gitlab });

    expect(markdown).toContain(
      '**Reports:** <a href="https://reports.example.com">Report</a>\n\n**Context:** <a href="https://gitlab.example.com/pipelines/42">42</a>\n\n**Allure TestOps:**',
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

    expect(markdown).not.toContain("**Context:**");
  });

  it("escapes run names and URLs and falls back to the run ID", () => {
    const ci = { ...jenkins, jobRunUrl: 'https://ci.example.com/?a=1&b="2"', jobRunUid: "42", jobRunName: "" };
    const fallback = render(ci);
    const named = render({ ...ci, jobRunName: '<tests> & "run"' });

    expect(fallback).toContain('**Context:** <a href="https://ci.example.com/?a=1&amp;b=&quot;2&quot;">42</a>');
    expect(named).toContain("&lt;tests&gt; &amp; &quot;run&quot;</a>");
  });
});
