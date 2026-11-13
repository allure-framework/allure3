import { execFileSync } from "node:child_process";
import { appendFile, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import ZipReadStream from "node-stream-zip";

const artifactName = ({ attempt, environment }) => `allure-recovery-${attempt}-${environment}`;
const isFailure = (status) => status === "failed" || status === "broken";
const isOutcome = (status) => status === "passed" || isFailure(status);
const label = (result, name) => result.labels?.find((entry) => entry.name === name)?.value;
const project = (result) => result.parameters?.find((entry) => entry.name === "Project")?.value ?? "";
const retry = (result) =>
  Number(result.parameters?.find((entry) => entry.name === "Retry" && entry.excluded)?.value ?? 0);

export const collectExecutions = (results, job) => {
  const groups = new Map();
  for (const result of Object.values(results)) {
    if (!result.retryHash || !result.id) {
      continue;
    }
    const type = label(result, "type");
    const module = label(result, "module") ?? label(result, "package");
    const key = JSON.stringify([result.retryHash, type, module, project(result)]);
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }

  const executions = [];
  for (const [key, group] of groups) {
    const finals = group.filter(({ isRetry }) => !isRetry);
    if (finals.length !== 1) {
      continue;
    }
    const [final] = finals;
    if (
      !isOutcome(final.status) ||
      !Number.isFinite(final.start) ||
      !Number.isFinite(final.stop) ||
      final.start < job.startedAt ||
      final.stop < final.start ||
      final.stop > job.finishedAt
    ) {
      continue;
    }

    const failure =
      label(final, "type") === "playwright" && final.status === "passed" && retry(final) > 0
        ? group
            .filter(
              (candidate) =>
                candidate.isRetry &&
                isFailure(candidate.status) &&
                Number.isFinite(candidate.start) &&
                Number.isFinite(candidate.stop) &&
                candidate.start >= job.startedAt &&
                candidate.stop >= candidate.start &&
                candidate.stop <= final.start &&
                retry(candidate) < retry(final),
            )
            .sort((a, b) => b.stop - a.stop)[0]
        : undefined;

    executions.push({
      key,
      name: final.fullName ?? final.name,
      project: project(final),
      id: final.id,
      status: final.status,
      start: final.start,
      stop: final.stop,
      ...(failure && { retryFailure: { id: failure.id, status: failure.status } }),
    });
  }
  return executions;
};

export const findRecoveries = (jobs, current) => {
  const ordered = jobs
    .filter((job) => job.runId === current.runId && job.attempt <= current.attempt)
    .sort((a, b) => a.attempt - b.attempt);
  const previous = new Map();
  const seen = new Set();
  const recoveries = [];
  for (const job of ordered) {
    const comparable = job.checkout && job.environment && job.runnerOS && job.arch && job.image && job.imageVersion;
    for (const result of job.executions) {
      if (!result.id || seen.has(result.id)) {
        continue;
      }
      seen.add(result.id);
      const pass = { job, result };
      if (job.attempt === current.attempt && result.status === "passed" && result.retryFailure) {
        recoveries.push({ kind: "Playwright retry", fail: { job, result: result.retryFailure }, pass });
      }
      if (!comparable) {
        continue;
      }
      const key = JSON.stringify([
        job.checkout,
        job.environment,
        job.runnerOS,
        job.arch,
        job.image,
        job.imageVersion,
        result.key,
      ]);
      const last = previous.get(key);
      if (
        job.attempt === current.attempt &&
        result.status === "passed" &&
        last &&
        isFailure(last.result.status) &&
        last.job.attempt < job.attempt &&
        last.job.jobId !== job.jobId &&
        last.job.finishedAt <= job.startedAt
      ) {
        recoveries.push({ kind: "GitHub job rerun", fail: last, pass });
      }
      previous.set(key, pass);
    }
  }
  return recoveries.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      a.pass.job.environment.localeCompare(b.pass.job.environment) ||
      a.pass.result.name.localeCompare(b.pass.result.name),
  );
};

const escapeCell = (value) =>
  String(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/[^\p{L}\p{N} ._-]/gu, (char) => `&#${char.codePointAt(0)};`);

const jobLink = (job, baseUrl) => `${baseUrl}/${job.runId}/job/${job.jobId}`;

export const formatSummary = (recoveries, baseUrl, reportUrl, publishedIds = new Set()) => {
  const link = ({ job, result }, currentJob) =>
    reportUrl && job === currentJob && /^[\da-f]{32}$/i.test(result.id) && publishedIds.has(result.id)
      ? new URL(`#${result.id}`, reportUrl).href
      : jobLink(job, baseUrl);
  const lines = [
    "## Flaky test recoveries",
    "",
    `Playwright retries: ${recoveries.filter(({ kind }) => kind === "Playwright retry").length}  `,
    `GitHub job reruns: ${recoveries.filter(({ kind }) => kind === "GitHub job rerun").length}`,
  ];
  if (recoveries.length === 0) {
    return lines.join("\n") + "\n";
  }

  lines.push("", "| Recovery | Test | Environment | Failed | Passed |", "| --- | --- | --- | --- | --- |");
  for (const { kind, fail, pass } of recoveries.slice(0, 100)) {
    const test = escapeCell(pass.result.name);
    const environment = escapeCell([pass.job.environment, pass.result.project].filter(Boolean).join(" / "));
    const failed = link(fail, pass.job);
    const passed = link(pass, pass.job);
    lines.push(`| ${kind} | ${test} | ${environment} | [${fail.result.status}](${failed}) | [passed](${passed}) |`);
  }
  if (recoveries.length > 100) {
    lines.push("", "The table shows the first 100 recoveries.");
  }
  return lines.join("\n") + "\n";
};

const collect = async (dumpPath, outputPath, environment, startedAt, finishedAt) => {
  const job = {
    runId: process.env.GITHUB_RUN_ID,
    attempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    jobId: process.env.CI_CHECK_RUN_ID,
    checkout: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    environment,
    runnerOS: process.env.RUNNER_OS,
    arch: process.env.RUNNER_ARCH,
    image: process.env.ImageOS,
    imageVersion: process.env.ImageVersion,
    startedAt: Number(startedAt),
    finishedAt: Number(finishedAt),
  };
  if (!/^\d+$/.test(job.runId) || !Number.isSafeInteger(job.attempt) || job.attempt < 1 || !/^\d+$/.test(job.jobId)) {
    throw new Error("Missing GitHub test job identity");
  }
  if (
    !Number.isSafeInteger(job.startedAt) ||
    !Number.isSafeInteger(job.finishedAt) ||
    job.startedAt <= 0 ||
    job.startedAt > job.finishedAt
  ) {
    throw new Error("Invalid test execution window");
  }
  const archive = new ZipReadStream.async({ file: dumpPath });
  try {
    const results = JSON.parse(await archive.entryData("test-results.json"));
    await writeFile(outputPath, JSON.stringify({ ...job, executions: collectExecutions(results, job) }));
  } finally {
    await archive.close();
  }
};

const summarize = async (directory, reportSummary) => {
  const current = { runId: process.env.GITHUB_RUN_ID, attempt: Number(process.env.GITHUB_RUN_ATTEMPT) };
  const baseUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs`;
  const names = await readdir(directory).catch((error) => {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  });
  const jobs = [];
  for (const name of names.filter((entry) => entry.startsWith("allure-recovery-"))) {
    try {
      const job = JSON.parse(await readFile(join(directory, name, "ci-recovery.json"), "utf8"));
      if (
        name !== artifactName(job) ||
        !/^\d+$/.test(job.jobId) ||
        !Number.isSafeInteger(job.attempt) ||
        !Array.isArray(job.executions)
      ) {
        throw new Error("Invalid job manifest");
      }
      jobs.push(job);
    } catch (error) {
      console.warn(`Skipping recovery data in ${name}: ${error.message}`);
    }
  }
  const fresh = jobs.filter((job) => job.runId === current.runId && job.attempt === current.attempt);
  const note =
    fresh.length === 0
      ? "\nNo results were collected by test jobs in this workflow attempt.\n"
      : `\nFresh results from: ${fresh
          .map((job) => escapeCell(job.environment))
          .sort()
          .join(", ")}.\n`;
  let reportUrl;
  let publishedIds;
  try {
    const { published, remoteHref } = JSON.parse(await readFile(reportSummary, "utf8"));
    if (published && /^https?:\/\//.test(remoteHref)) {
      reportUrl = remoteHref;
      const results = join(dirname(reportSummary), "data", "test-results");
      publishedIds = new Set(
        (await readdir(results))
          .filter((filename) => /^[\da-f]{32}\.json$/i.test(filename))
          .map((name) => name.slice(0, -5)),
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not read the published report URL: ${error.message}`);
    }
  }
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    formatSummary(findRecoveries(jobs, current), baseUrl, reportUrl, publishedIds) + note,
  );
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , command, ...args] = process.argv;
  if (command === "collect" && args.length === 5) {
    await collect(...args);
  } else if (command === "summary" && args.length === 2) {
    await summarize(...args);
  } else {
    throw new Error(
      "Usage: ci-flake-recoveries.mjs collect <dump> <output> <environment> <started-at> <finished-at> | summary <artifacts> <report-summary>",
    );
  }
}
