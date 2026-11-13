import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import type { HistoryTestResult, TestResult } from "@allurereport/core-api";
import { describe, expect, it } from "vite-plus/test";
import ZipWriteStream from "zip-stream";

import { collectExecutions, findRecoveries, formatSummary } from "../../../scripts/ci-flake-recoveries.mjs";
import { createFlakyDetector } from "../src/utils/flaky.js";
import fixture from "./fixtures/ci-flake-recoveries.json";

type Replay = (typeof fixture)[keyof typeof fixture];

const collect = ({ jobs }: Replay) =>
  jobs.map(({ results, ...job }) => ({ ...job, executions: collectExecutions(results, job) }));
const replay = (scenario: Replay) => findRecoveries(collect(scenario), scenario.current);
const baseUrl = "https://github.com/allure-framework/allure3/actions/runs";

describe("CI flaky test recoveries", () => {
  it("recognizes the step-toggle Playwright retry and checks both report algorithms", () => {
    const [job] = fixture.playwrightRetry.jobs;
    const [failure, pass] = job.results;
    const [recovery] = replay(fixture.playwrightRetry);

    expect(recovery).toMatchObject({
      kind: "Playwright retry",
      fail: { result: { id: failure.id } },
      pass: { result: { id: pass.id } },
    });
    const result = { ...pass, retries: [failure] } as TestResult;
    expect(createFlakyDetector({ algorithm: "retry-failure-rate", includePassedTests: true })(result, [])).toBe(true);
    expect(createFlakyDetector({ algorithm: "retry-failure-rate" })(result, [])).toBe(false);
    expect(createFlakyDetector({ algorithm: "status-changes", includePassedTests: true })(result, [])).toBe(false);

    const reportUrl = "https://example.org/awesome/index.html";
    const summary = formatSummary([recovery], baseUrl, reportUrl, new Set([pass.id, failure.id]));
    expect(summary).toContain(`[failed](${reportUrl}#${failure.id})`);
    expect(summary).toContain(`[passed](${reportUrl}#${pass.id})`);
  });

  it("links a failed GitHub job to the passing test in the next attempt", () => {
    const recoveries = replay(fixture.githubRerun);
    const [failedJob, passedJob] = fixture.githubRerun.jobs;
    const [failure] = failedJob.results;
    const [retry, pass] = passedJob.results;
    expect(recoveries.map(({ kind }) => kind)).toEqual(["GitHub job rerun", "Playwright retry"]);
    const summary = formatSummary(recoveries, baseUrl, "https://example.org/awesome/index.html", new Set([pass.id]));
    expect(summary).toContain(`[failed](${baseUrl}/41031107948/job/123982009898)`);
    expect(summary).toContain("[passed](https://example.org/awesome/index.html#" + pass.id + ")");
    expect(summary).toContain(`[failed](${baseUrl}/41031107948/job/124049992134)`);

    const result = { ...pass, retries: [retry] } as TestResult;
    const history: HistoryTestResult[] = [
      { id: failure.id, name: failure.fullName, status: "failed", retries: [], url: "", retryHash: failure.retryHash },
    ];
    expect(createFlakyDetector({ algorithm: "status-changes", includePassedTests: true })(result, history)).toBe(false);
    expect(createFlakyDetector({ algorithm: "retry-failure-rate", includePassedTests: true })(result, history)).toBe(
      true,
    );
  });

  it("ignores retained artifacts and reused result IDs on a partial rerun", () => {
    const { current } = fixture.reusedJob;
    const [job] = collect(fixture.reusedJob);
    expect(findRecoveries([job], current)).toEqual([]);
    expect(findRecoveries([job, { ...job, attempt: 2, jobId: "127796970370" }], current)).toEqual([]);
  });

  it("requires a fresh test on the same checkout and runner image", () => {
    expect(replay(fixture.changedCheckout)).toEqual([]);
    const [failedJob, passedJob] = collect(fixture.changedCheckout);
    const next = { ...passedJob, runId: failedJob.runId, attempt: 2, imageVersion: failedJob.imageVersion };
    expect(findRecoveries([failedJob, next], next)).toEqual([]);
    const [failure, pass] = collect(fixture.githubRerun);
    expect(findRecoveries([failure, { ...pass, imageVersion: "changed" }], pass)).toHaveLength(1);
    expect(findRecoveries([failure, { ...pass, executions: [] }], pass)).toEqual([]);
  });

  it("requires actual retry evidence from the current job window", () => {
    const [job] = fixture.playwrightRetry.jobs;
    const [failure, pass] = job.results;
    for (const retry of [
      { ...failure, start: job.startedAt - 1 },
      { ...failure, stop: pass.start + 1 },
      { ...failure, status: "skipped" },
    ]) {
      expect(collectExecutions([retry, pass], job)[0]).not.toHaveProperty("retryFailure");
    }
    expect(collectExecutions([failure, { ...pass, parameters: [] }], job)[0]).not.toHaveProperty("retryFailure");
    expect(collectExecutions([failure, { ...pass, stop: job.finishedAt + 1 }], job)).toEqual([]);
  });

  it("collects a dump and writes the GitHub step summary through the script", async ({ onTestFinished }) => {
    const directory = await mkdtemp(join(tmpdir(), "allure-ci-recovery-"));
    onTestFinished(() => rm(directory, { recursive: true, force: true }));
    const summary = join(directory, "summary.md");
    const script = resolve(import.meta.dirname, "../../../scripts/ci-flake-recoveries.mjs");
    const run = promisify(execFile);
    const env = {
      ...process.env,
      GITHUB_RUN_ID: fixture.githubRerun.current.runId,
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "allure-framework/allure3",
      GITHUB_STEP_SUMMARY: summary,
    };

    for (const job of fixture.githubRerun.jobs) {
      const artifact = join(directory, `allure-recovery-${job.attempt}-${job.environment}`);
      const dump = join(directory, `dump-${job.attempt}.zip`);
      const archive = new ZipWriteStream();
      const chunks: Buffer[] = [];
      archive.on("data", (chunk: Buffer) => chunks.push(chunk));
      const completed = new Promise<void>((resolve, reject) => {
        archive.once("end", resolve);
        archive.once("error", reject);
      });
      const results = Object.fromEntries(job.results.map((result) => [result.id, result]));
      archive.entry(Buffer.from(JSON.stringify(results)), { name: "test-results.json" }, (error) => {
        if (error) {
          archive.destroy(error);
        } else {
          archive.finalize();
        }
      });
      await completed;
      await writeFile(dump, Buffer.concat(chunks));
      await mkdir(artifact);
      await run(
        process.execPath,
        [
          script,
          "collect",
          dump,
          join(artifact, "ci-recovery.json"),
          job.environment,
          String(job.startedAt),
          String(job.finishedAt),
        ],
        {
          env: {
            ...env,
            GITHUB_RUN_ATTEMPT: String(job.attempt),
            CI_CHECK_RUN_ID: job.jobId,
            RUNNER_OS: job.runnerOS,
            RUNNER_ARCH: job.arch,
            ImageOS: job.image,
            ImageVersion: job.imageVersion,
          },
        },
      );
    }

    const pass = fixture.githubRerun.jobs[1].results[1];
    const reportDirectory = join(directory, "report", "awesome");
    const resultsDirectory = join(reportDirectory, "data", "test-results");
    const reportSummary = join(reportDirectory, "summary.json");
    const reportUrl = "https://example.org/awesome/index.html";
    await mkdir(resultsDirectory, { recursive: true });
    await writeFile(join(resultsDirectory, `${pass.id}.json`), "{}");
    await writeFile(reportSummary, JSON.stringify({ published: true, remoteHref: reportUrl }));
    await run(process.execPath, [script, "summary", directory, reportSummary], {
      env: { ...env, GITHUB_RUN_ATTEMPT: "2" },
    });

    const output = await readFile(summary, "utf8");
    expect(output).toContain("Playwright retries: 1");
    expect(output).toContain("GitHub job reruns: 1");
    expect(output).toContain(`[failed](${baseUrl}/41031107948/job/123982009898)`);
    expect(output).toContain(`[failed](${baseUrl}/41031107948/job/124049992134)`);
    expect(output).toContain(`[passed](${reportUrl}#${pass.id})`);
  });
});
