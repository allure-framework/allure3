import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";

import {
  type GitlabCiDescriptor,
  type ReportContext,
  detect,
  restoreGitlabHistory,
  upsertGitlabJobNote,
} from "@allurereport/ci";
import { readConfig } from "@allurereport/core";
import { CiType } from "@allurereport/core-api";
import { run } from "clipanion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generate } from "../../../src/commands/commons/generate.js";
import { GitlabGenerateCommand } from "../../../src/commands/gitlab/generate.js";

vi.mock("node:fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs")>()),
  existsSync: vi.fn(),
}));
vi.mock("@allurereport/core", () => ({
  readConfig: vi.fn(),
}));
vi.mock("@allurereport/ci", () => ({
  detect: vi.fn(),
  restoreGitlabHistory: vi.fn(),
  upsertGitlabJobNote: vi.fn(),
}));
vi.mock("../../../src/commands/commons/generate.js", () => ({
  generate: vi.fn(),
}));

const artifactBaseUrl = "https://group.gitlab.io/-/project/-/jobs/123/artifacts";
const gitlabCi: GitlabCiDescriptor = {
  type: CiType.Gitlab,
  detected: true,
  repoName: "project",
  jobUid: "1",
  jobUrl: "https://gitlab.com/group/project/pipelines",
  jobName: "project",
  jobRunUid: "100",
  jobRunUrl: "https://gitlab.com/group/project/-/pipelines/100",
  jobRunName: "100",
  jobRunBranch: "feature",
  pullRequestName: "Feature",
  pullRequestUrl: "https://gitlab.com/group/project/-/merge_requests/7",
  projectId: "1",
  projectPath: "group/project",
  projectDirectory: "/tmp/project",
  pipelineSource: "merge_request_event",
  ciJobName: "generate-report",
  currentJobId: "123",
  currentJobUrl: "https://gitlab.com/group/project/-/jobs/123",
  mergeRequestProjectId: "1",
  restApiUrl: "https://gitlab.com/api/v4",
  graphqlApiUrl: "https://gitlab.com/api/graphql",
  ref: "feature",
  jobArtifactsUrlBase: artifactBaseUrl,
};
const baseConfig = {
  name: "Allure Report",
  output: "/tmp/allure-report",
  historyPath: "/tmp/history.jsonl",
  historyLimit: 100,
  historyBaseUrl: "https://group.gitlab.io/-/project/-/jobs/123/artifacts/allure-report",
  open: false,
};
const summary: ReportContext = {
  reports: [],
  testResults: { byId: { one: { id: "one", name: "test", status: "passed", duration: 42 } } },
  totals: {
    duration: 42,
    stats: { total: 1, passed: 1, failed: 0, broken: 0, skipped: 0, unknown: 0 },
    flags: { new: 1, flaky: 0, retry: 0 },
    resolutions: { issues: 0, muted: 0, accepted: 0 },
  },
  environments: [],
  artifacts: [],
};
const runCommand = (argv: string[] = [], stdout = new PassThrough(), stderr = new PassThrough()) =>
  run(GitlabGenerateCommand, ["gitlab", ...argv], { stdout, stderr });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("GITLAB_TOKEN", undefined);
  vi.mocked(detect).mockReturnValue(gitlabCi);
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readConfig).mockResolvedValue(baseConfig as never);
  vi.mocked(restoreGitlabHistory).mockResolvedValue(undefined);
  vi.mocked(generate).mockResolvedValue({ summary });
  vi.mocked(upsertGitlabJobNote).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("gitlab command", () => {
  it.each([
    { name: "CLI token precedence", cliToken: " cli-token ", envToken: "env-token", expected: "cli-token" },
    { name: "environment token", cliToken: undefined, envToken: " env-token ", expected: "env-token" },
    { name: "blank CLI token", cliToken: " ", envToken: "env-token", expected: "env-token" },
    { name: "absent credentials", cliToken: undefined, envToken: undefined, expected: undefined },
    { name: "blank credentials", cliToken: " ", envToken: " ", expected: undefined },
  ])("passes the resolved token to history and note operations for $name", async ({ cliToken, envToken, expected }) => {
    vi.stubEnv("GITLAB_TOKEN", envToken);
    const args = cliToken === undefined ? [] : ["--gitlab-token", cliToken];

    await expect(runCommand(args)).resolves.toBe(0);

    expect(restoreGitlabHistory).toHaveBeenCalledWith({ token: expected, historyPath: "history.jsonl" });
    if (expected) {
      expect(upsertGitlabJobNote).toHaveBeenCalledWith(expect.objectContaining({ token: expected }));
    } else {
      expect(upsertGitlabJobNote).not.toHaveBeenCalled();
    }
  });

  it("skips GitLab artifact history when a Service token is configured", async () => {
    const config = { ...baseConfig, allureService: { accessToken: "service-token" } };
    vi.mocked(readConfig).mockResolvedValueOnce(config as never);

    await expect(runCommand(["--gitlab-token", "gitlab-token"])).resolves.toBe(0);

    expect(restoreGitlabHistory).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ config, collectSummary: true }));
    expect(upsertGitlabJobNote).toHaveBeenCalledOnce();
  });

  it.each([undefined, ""])("restores artifact history when the Service token is %j", async (accessToken) => {
    const config = { ...baseConfig, allureService: { accessToken } };
    vi.mocked(readConfig).mockResolvedValueOnce(config as never);

    await expect(runCommand()).resolves.toBe(0);

    expect(restoreGitlabHistory).toHaveBeenCalledWith({ token: undefined, historyPath: "history.jsonl" });
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ config }));
  });

  it("includes the default output folder in historyBaseUrl, then restores, generates and posts in order", async () => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    await expect(runCommand(["--gitlab-token", "token-from-cli", "./results"], stdout, stderr)).resolves.toBe(0);

    expect(console.error).not.toHaveBeenCalled();

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: undefined,
      output: "allure-report",
      historyPath: "history.jsonl",
      historyLimit: 100,
      historyBaseUrl: "https://group.gitlab.io/-/project/-/jobs/123/artifacts/allure-report",
    });
    expect(restoreGitlabHistory).toHaveBeenCalledWith({ token: "token-from-cli", historyPath: "history.jsonl" });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ collectSummary: true, resultsDir: ["./results"], config: baseConfig }),
    );
    expect(existsSync).toHaveBeenCalledWith(join(baseConfig.output, "index.html"));
    expect(upsertGitlabJobNote).toHaveBeenCalledWith({
      token: "token-from-cli",
      reportUrl: "https://group.gitlab.io/-/project/-/jobs/123/artifacts/allure-report/index.html",
      summary,
    });
    expect(console.log).toHaveBeenCalledWith(
      "GitLab report URL: https://group.gitlab.io/-/project/-/jobs/123/artifacts/allure-report/index.html",
    );
    expect(vi.mocked(restoreGitlabHistory).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(generate).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(generate).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(upsertGitlabJobNote).mock.invocationCallOrder[0],
    );
  });

  it.each([
    { name: "relative", output: "reports/cli-report" },
    { name: "absolute within CI_PROJECT_DIR", output: resolve(gitlabCi.projectDirectory, "reports/cli-report") },
  ])("builds the default historyBaseUrl for $name output path", async ({ output }) => {
    await expect(runCommand(["--output", output])).resolves.toBe(0);

    expect(readConfig).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({
        output,
        historyBaseUrl: "https://group.gitlab.io/-/project/-/jobs/123/artifacts/reports/cli-report",
      }),
    );
  });

  it("rejects an absolute output path outside CI_PROJECT_DIR before generation", async () => {
    const stdout = new PassThrough();
    const output = resolve(`${gitlabCi.projectDirectory}-outside`, "report");

    await expect(runCommand(["--output", output], stdout)).resolves.toBe(1);

    expect(stdout.read()?.toString()).toContain("Absolute output path must be within CI_PROJECT_DIR");
    expect(readConfig).not.toHaveBeenCalled();
    expect(restoreGitlabHistory).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(upsertGitlabJobNote).not.toHaveBeenCalled();
  });

  it("preserves an explicit historyBaseUrl without appending the output folder", async () => {
    const config = {
      ...baseConfig,
      name: "CLI Name",
      output: "/tmp/reports/cli-report",
      historyPath: "/tmp/cli-history.jsonl",
      historyLimit: 7,
      historyBaseUrl: "https://reports.example.test/runs/7",
    };
    vi.mocked(readConfig).mockResolvedValueOnce(config as never);
    const stdout = new PassThrough();

    await expect(
      runCommand(
        [
          "--output",
          "reports/cli-report",
          "--report-name",
          "CLI Name",
          "--history-path",
          "cli-history.jsonl",
          "--history-limit",
          "7",
          "--history-base-url",
          "https://reports.example.test/runs/7",
          "--gitlab-token",
          "token",
        ],
        stdout,
      ),
    ).resolves.toBe(0);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), undefined, {
      name: "CLI Name",
      output: "reports/cli-report",
      historyPath: "cli-history.jsonl",
      historyLimit: 7,
      historyBaseUrl: "https://reports.example.test/runs/7",
    });
    expect(restoreGitlabHistory).toHaveBeenCalledWith(expect.objectContaining({ historyPath: "cli-history.jsonl" }));
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ config }));
    expect(existsSync).toHaveBeenCalledWith(join("/tmp", "reports/cli-report", "index.html"));
    expect(upsertGitlabJobNote).toHaveBeenCalledWith(
      expect.objectContaining({ reportUrl: "https://reports.example.test/runs/7/index.html" }),
    );
    expect(console.log).toHaveBeenCalledWith("GitLab report URL: https://reports.example.test/runs/7/index.html");
  });

  it("generates report with failure to fetch history", async () => {
    vi.mocked(restoreGitlabHistory).mockRejectedValueOnce(new Error("artifact download failed"));
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    await expect(runCommand(["--gitlab-token", "token"], stdout, stderr)).resolves.toBe(0);

    expect(console.error).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("artifact download failed"));
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("artifact download failed"));
    expect(generate).toHaveBeenCalledOnce();
    expect(upsertGitlabJobNote).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("GitLab report URL:"));
  });

  it.each([
    { name: "an existing config file", exists: true, expected: "custom.mjs" },
    { name: "a missing config file", exists: false, expected: undefined },
  ])("resolves $name through readConfig", async ({ exists, expected }) => {
    vi.mocked(existsSync).mockImplementation((path) => String(path) !== "custom.mjs" || exists);

    await expect(runCommand(["--config", "custom.mjs"])).resolves.toBe(0);

    expect(readConfig).toHaveBeenCalledWith(expect.any(String), expected, expect.any(Object));
    expect(generate).toHaveBeenCalledOnce();
  });

  it.each([
    { value: "0", expected: 0 },
    { value: "7", expected: 7 },
    { value: "bad", expected: 100 },
    { value: "-1", expected: 100 },
    { value: "1.5", expected: 100 },
    { value: "1e309", expected: 100 },
  ])("passes history limit $value as $expected instead of rejecting the command", async ({ value, expected }) => {
    await expect(runCommand([`--history-limit=${value}`])).resolves.toBe(0);

    expect(readConfig).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.objectContaining({ historyLimit: expected }),
    );
    expect(generate).toHaveBeenCalledOnce();
  });

  it("preserves results, dump inputs and resolved renderer settings", async () => {
    const config = {
      ...baseConfig,
      appendHistory: false,
      plugins: [{ id: "classic", enabled: true, plugin: {}, options: {} }],
    };
    vi.mocked(readConfig).mockResolvedValueOnce(config as never);

    await expect(runCommand(["--dump", "dump.zip", "./results"])).resolves.toBe(0);

    expect(readConfig).toHaveBeenCalledWith(
      expect.any(String),
      undefined,
      expect.not.objectContaining({ plugins: expect.anything() }),
    );
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ dump: ["dump.zip"], resultsDir: ["./results"], config }),
    );
  });

  it.each([
    { name: "without a URL override", args: [] },
    { name: "with a URL override", args: ["--history-base-url", "https://reports.example.test/run"] },
  ])("requires GitLab CI $name before reading config or generating", async ({ args }) => {
    vi.mocked(detect).mockReturnValue({ ...gitlabCi, type: CiType.Local });
    const stdout = new PassThrough();

    await expect(runCommand(args, stdout)).resolves.toBe(1);

    expect(stdout.read()?.toString()).toContain("GitLab CI environment was not detected");
    expect(readConfig).not.toHaveBeenCalled();
    expect(restoreGitlabHistory).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(upsertGitlabJobNote).not.toHaveBeenCalled();
  });

  it("propagates generation errors without posting a note", async () => {
    vi.mocked(generate).mockRejectedValueOnce(new Error("generation failed"));
    const stdout = new PassThrough();
    const stderr = new PassThrough();

    await expect(runCommand([], stdout, stderr)).resolves.toBe(1);

    expect(stdout.read()?.toString()).toContain("generation failed");
    expect(stderr.read()).toBeNull();
    expect(upsertGitlabJobNote).not.toHaveBeenCalled();
  });

  it("does not print a report link or post a note when generation does not complete", async () => {
    vi.mocked(generate).mockResolvedValueOnce(undefined);
    const stdout = new PassThrough();

    await expect(runCommand([], stdout)).resolves.toBe(0);

    expect(generate).toHaveBeenCalledOnce();
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining("GitLab report URL:"));
    expect(upsertGitlabJobNote).not.toHaveBeenCalled();
  });

  it("prints the report link but does not post a note when generation omits the summary", async () => {
    vi.mocked(generate).mockResolvedValueOnce({});
    const stdout = new PassThrough();

    await expect(runCommand([], stdout)).resolves.toBe(0);

    expect(generate).toHaveBeenCalledOnce();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("GitLab report URL:"));
    expect(upsertGitlabJobNote).not.toHaveBeenCalled();
  });

  it("does not post a note when the generated report entry point is absent", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(runCommand()).resolves.toBe(0);

    expect(generate).toHaveBeenCalledOnce();
    expect(existsSync).toHaveBeenCalledWith(join(baseConfig.output, "index.html"));
    expect(upsertGitlabJobNote).not.toHaveBeenCalled();
  });
});
