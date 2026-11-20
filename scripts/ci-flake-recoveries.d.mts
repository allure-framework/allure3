import type { TestResult, TestStatus } from "@allurereport/core-api";

type JobIdentity = {
  runId: string;
  attempt: number;
};

type Job = JobIdentity & {
  jobId: string;
  checkout: string;
  environment: string;
  runnerOS: string;
  arch: string;
  image: string;
  imageVersion: string;
  startedAt: number;
  finishedAt: number;
};

type DumpResult = Omit<
  Pick<TestResult, "id" | "name" | "fullName" | "status" | "start" | "stop" | "retryHash" | "isRetry" | "labels">,
  "name" | "status"
> & {
  name?: string;
  status: string;
  parameters?: Pick<TestResult["parameters"][number], "name" | "value" | "excluded">[];
};

type Outcome = {
  id: string;
  status: TestStatus;
};

type Execution = Outcome & {
  key: string;
  name: string;
  project: string;
  start: number;
  stop: number;
  retryFailure?: Outcome;
};

type Recovery = {
  kind: "Playwright retry" | "GitHub job rerun";
  fail: { job: Job; result: Outcome };
  pass: { job: Job; result: Execution };
};

export function collectExecutions(results: Record<string, DumpResult> | DumpResult[], job: Job): Execution[];
export function findRecoveries(jobs: (Job & { executions: Execution[] })[], current: JobIdentity): Recovery[];
export function formatSummary(
  recoveries: Recovery[],
  baseUrl: string,
  reportUrl?: string,
  publishedIds?: Set<string>,
): string;
