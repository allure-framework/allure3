import process from "node:process";
import { clearLine, cursorTo } from "node:readline";

import type { AttachmentLink, Statistic, TestError, TestResult, TestStatus } from "@allurereport/core-api";
import { formatDuration } from "@allurereport/core-api";
import type { AllureStore, QualityGateValidationResult, RealtimeSubscriber } from "@allurereport/plugin-api";
import { blue, gray, green, red, yellow } from "yoctocolors";

export const PROGRESS_CONSOLE_MODES = [
  "rich",
  "progress",
  "errors",
  "summary",
  "pipe-summary",
  "pipe",
  "silent",
] as const;

export type ProgressConsoleMode = (typeof PROGRESS_CONSOLE_MODES)[number];

type OutputStream = Pick<NodeJS.WriteStream, "write" | "isTTY">;
const asWritableStream = (stream: OutputStream) => stream as NodeJS.WriteStream;

const SUMMARY_MODES = new Set<ProgressConsoleMode>(["rich", "progress", "errors", "summary", "pipe-summary"]);
const PIPE_MODES = new Set<ProgressConsoleMode>(["pipe", "pipe-summary"]);
const PROGRESS_MODES = new Set<ProgressConsoleMode>(["rich", "progress"]);
const LIVE_ERROR_MODES = new Set<ProgressConsoleMode>(["rich", "errors"]);
const STATUS_COUNTER_ORDER: TestStatus[] = ["passed", "failed", "broken", "skipped", "unknown"];
const LOW_VALUE_STDERR_WARNING_PATTERNS = [
  /\bNO_COLOR\b/i,
  /\bExperimentalWarning\b/i,
  /\bDeprecationWarning\b/i,
  /\bAllure TestOps\b/i,
  /\bCJS build of Vite's Node API is deprecated\b/i,
] as const;
const VITEST_SETUP_FRAME_PATTERN = /^\d+\|\s*(beforeAll|beforeEach|afterAll|afterEach)\b/i;
const ACTIONABLE_STDERR_PATTERNS = [
  {
    kind: "setup",
    pattern: /\b(xcresulttool|xcrun: error: unable to find utility|not a developer tool or in PATH)\b/i,
  },
  {
    kind: "import",
    pattern:
      /\b(ERR_MODULE_NOT_FOUND|Cannot find module|Cannot find package|Failed to resolve import|Failed to load url|Module not found)\b/i,
  },
  {
    kind: "suite-load",
    pattern: /\b(Unhandled Error|Error while loading|Failed to load test file|Failed to collect tests)\b/i,
  },
  {
    kind: "setup",
    pattern: /\b(beforeAll|beforeEach|afterAll|afterEach|global setup|setup failed|setup error)\b/i,
  },
] as const;
const STACK_TRACE_LINE_PATTERN = /^\s*(at\s+|file:|node:internal|Caused by:\s*$|\^+$)/;

type RunnerIssueKind = "import" | "suite-load" | "setup" | "global-error";
type RunnerIssueSummary = {
  source: "stderr" | "global_error";
  kind: RunnerIssueKind;
  message: string;
  count: number;
};

const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;
const attachmentName = (link: AttachmentLink) => ("name" in link ? link.name : undefined);

const statusColor = (status: TestStatus) => {
  switch (status) {
    case "passed":
      return green;
    case "failed":
      return red;
    case "broken":
      return yellow;
    case "skipped":
      return gray;
    default:
      return blue;
  }
};

const statusBadge = (status: TestStatus) => {
  switch (status) {
    case "passed":
      return green("PASS");
    case "failed":
      return red("FAIL");
    case "broken":
      return yellow("BROKEN");
    case "skipped":
      return gray("SKIP");
    default:
      return blue("UNKNOWN");
  }
};

const shortErrorMessage = (error?: TestError) => {
  if (error?.message?.trim()) {
    return error.message.trim();
  }

  const firstTraceLine = error?.trace
    ?.split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstTraceLine;
};

const formatTestHighlight = (testResult: TestResult) => {
  const title = testResult.fullName ?? testResult.name;
  const errorMessage = shortErrorMessage(testResult.error);
  const duration = testResult.duration ? gray(`(${formatDuration(testResult.duration)})`) : "";

  return [statusBadge(testResult.status), title, duration, errorMessage ? gray(`- ${errorMessage}`) : ""]
    .filter(Boolean)
    .join(" ");
};

const formatStatsCounters = (stats: Statistic) =>
  STATUS_COUNTER_ORDER.map((status) => {
    const count = stats[status] ?? 0;

    if (!count) {
      return undefined;
    }

    return statusColor(status)(`${count} ${status}`);
  })
    .filter(Boolean)
    .join(" | ");

const formatProgressLine = (stats: Statistic) => {
  const counters = formatStatsCounters(stats);

  return counters ? `Allure live: ${counters} | total ${stats.total}` : `Allure live: total ${stats.total}`;
};

const summarizeRunnerErrors = (globalErrors: TestError[]) =>
  globalErrors.map((error) => {
    const primaryMessage = error.message?.trim();
    const traceLine = error.trace
      ?.split("\n")
      .map((line) => line.trim())
      .find(Boolean);

    if (primaryMessage && traceLine && traceLine !== primaryMessage) {
      return `${primaryMessage} - ${traceLine}`;
    }

    return primaryMessage ?? traceLine ?? "Unknown runner error";
  });

const normalizeLogLine = (value: string) => value.replace(/\s+/g, " ").trim();

const normalizeWarningLine = (value: string) =>
  normalizeLogLine(value).replace(/^\(node:\d+\)\s+Warning:\s*/i, "Warning: ");

const buildCountedValues = (values: string[]) => {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((left, right) => right.count - left.count || left.message.localeCompare(right.message));
};

const classifyRunnerIssueKind = (value: string): RunnerIssueKind | undefined => {
  const normalized = normalizeLogLine(value);

  for (const { kind, pattern } of ACTIONABLE_STDERR_PATTERNS) {
    if (pattern.test(normalized)) {
      return kind;
    }
  }

  return undefined;
};

const classifyStderr = (content?: string) => {
  if (!content?.trim()) {
    return {
      actionable: [] as RunnerIssueSummary[],
      noisyWarnings: [] as Array<{ message: string; count: number }>,
    };
  }

  const actionableLines: RunnerIssueSummary[] = [];
  const warningLines: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = normalizeLogLine(rawLine);

    if (!line || STACK_TRACE_LINE_PATTERN.test(rawLine) || VITEST_SETUP_FRAME_PATTERN.test(line)) {
      continue;
    }

    if (LOW_VALUE_STDERR_WARNING_PATTERNS.some((pattern) => pattern.test(line))) {
      warningLines.push(normalizeWarningLine(line));
      continue;
    }

    const kind = classifyRunnerIssueKind(line);

    if (kind) {
      actionableLines.push({
        source: "stderr",
        kind,
        message: line,
        count: 1,
      });
    }
  }

  const actionable = Array.from(
    actionableLines.reduce((acc, issue) => {
      const key = `${issue.source}:${issue.kind}:${issue.message}`;
      const current = acc.get(key);

      if (current) {
        current.count += 1;
      } else {
        acc.set(key, { ...issue });
      }

      return acc;
    }, new Map<string, RunnerIssueSummary>()),
  )
    .map(([, issue]) => issue)
    .sort((left, right) => right.count - left.count || left.message.localeCompare(right.message));

  return {
    actionable,
    noisyWarnings: buildCountedValues(warningLines),
  };
};

const summarizeGlobalErrorIssues = (errors: TestError[]) =>
  Array.from(
    errors.reduce((acc, error) => {
      const primaryMessage = normalizeLogLine(error.message ?? "");
      const traceLine = normalizeLogLine(error.trace?.split(/\r?\n/)[0] ?? "");
      const message =
        primaryMessage && traceLine && traceLine !== primaryMessage
          ? `${primaryMessage} - ${traceLine}`
          : primaryMessage || traceLine;

      if (!message) {
        return acc;
      }

      const issue: RunnerIssueSummary = {
        source: "global_error",
        kind: classifyRunnerIssueKind(message) ?? "global-error",
        message,
        count: 1,
      };
      const key = `${issue.source}:${issue.kind}:${issue.message}`;
      const current = acc.get(key);

      if (current) {
        current.count += 1;
      } else {
        acc.set(key, issue);
      }

      return acc;
    }, new Map<string, RunnerIssueSummary>()),
  )
    .map(([, issue]) => issue)
    .sort((left, right) => right.count - left.count || left.message.localeCompare(right.message));

const readGlobalStderr = async (store: AllureStore) => {
  const globalAttachments = await store.allGlobalAttachments();
  const stderrAttachment = globalAttachments.find(
    (attachment) => attachment.originalFileName === "stderr.txt" || attachmentName(attachment) === "stderr.txt",
  );

  if (!stderrAttachment) {
    return undefined;
  }

  const content = await store.attachmentContentById(stderrAttachment.id);
  return content?.asUtf8String();
};

const buildStatsFromResults = (testResults: TestResult[]): Statistic => {
  const stats: Statistic = { total: testResults.length };

  testResults.forEach(({ status }) => {
    stats[status] = (stats[status] ?? 0) + 1;
  });

  return stats;
};

const sumDurations = (testResults: TestResult[]) =>
  testResults.reduce((acc, testResult) => acc + (testResult.duration ?? 0), 0);

const limitLines = (lines: string[], maxLines: number) => {
  if (lines.length <= maxLines) {
    return lines;
  }

  return [...lines.slice(0, maxLines), gray(`... and ${lines.length - maxLines} more`)];
};

const isProgressConsoleMode = (value: string): value is ProgressConsoleMode =>
  (PROGRESS_CONSOLE_MODES as readonly string[]).includes(value);

export const resolveProgressConsoleMode = (consoleMode: string | undefined, silent: boolean): ProgressConsoleMode => {
  if (consoleMode !== undefined && silent) {
    throw new Error("Cannot combine --console with --silent. Use --console=silent or remove --silent.");
  }

  if (silent) {
    return "silent";
  }

  if (consoleMode === undefined) {
    return "rich";
  }

  if (!isProgressConsoleMode(consoleMode)) {
    throw new Error(`Unknown console mode "${consoleMode}". Expected one of: ${PROGRESS_CONSOLE_MODES.join(", ")}.`);
  }

  return consoleMode;
};

export class ProgressConsolePresenter {
  readonly #mode: ProgressConsoleMode;
  readonly #stdout: OutputStream;
  readonly #stderr: OutputStream;
  readonly #seenHighlights = new Set<string>();
  readonly #unsubscribeCallbacks: Array<() => void> = [];
  readonly #rerunAttempts: Array<{ attempt: number; tests: string[] }> = [];

  #store?: AllureStore;
  #latestProgressLine = "";
  #statusLineVisible = false;
  #qualityGateResults: QualityGateValidationResult[] = [];

  constructor(params: { mode: ProgressConsoleMode; stdout?: OutputStream; stderr?: OutputStream }) {
    const { mode, stdout = process.stdout, stderr = process.stderr } = params;

    this.#mode = mode;
    this.#stdout = stdout;
    this.#stderr = stderr;
  }

  get mode() {
    return this.#mode;
  }

  get shouldMirrorProcessOutput() {
    return PIPE_MODES.has(this.#mode);
  }

  get shouldPrintFinalSummary() {
    return SUMMARY_MODES.has(this.#mode);
  }

  get isSilent() {
    return this.#mode === "silent";
  }

  attach = async (store: AllureStore, realtime: RealtimeSubscriber) => {
    this.#store = store;

    this.#unsubscribeCallbacks.push(
      realtime.onTestResults(async (testResultIds) => {
        await this.#handleTestResults(testResultIds);
      }),
    );
    this.#unsubscribeCallbacks.push(
      realtime.onGlobalError(async (error) => {
        if (LIVE_ERROR_MODES.has(this.#mode)) {
          this.#printEventLine(`${red("Runner error:")} ${summarizeRunnerErrors([error])[0]}`, this.#stderr);
        }
      }),
    );
    this.#unsubscribeCallbacks.push(
      realtime.onQualityGateResults(async (results) => {
        this.#qualityGateResults = results;
      }),
    );

    if (PROGRESS_MODES.has(this.#mode)) {
      await this.#renderProgressLine();
    }
  };

  dispose = () => {
    this.#clearStatusLine();

    while (this.#unsubscribeCallbacks.length) {
      this.#unsubscribeCallbacks.pop()?.();
    }
  };

  printCommand = (command: string, commandArgs: string[]) => {
    if (this.isSilent) {
      return;
    }

    this.#printEventLine(gray(`Running: ${[command, ...commandArgs].join(" ")}`), this.#stdout);
  };

  handleProcessStdout = (chunk: string) => {
    if (!this.shouldMirrorProcessOutput || this.isSilent) {
      return;
    }

    this.#stdout.write(chunk);
  };

  handleProcessStderr = (chunk: string) => {
    if (!this.shouldMirrorProcessOutput || this.isSilent) {
      return;
    }

    this.#stderr.write(chunk);
  };

  logRerunStart = (attempt: number, testResults: TestResult[]) => {
    this.#rerunAttempts.push({
      attempt,
      tests: testResults.map((testResult) => testResult.fullName ?? testResult.name),
    });

    if (this.isSilent) {
      return;
    }

    this.#printEventLine(yellow(`Rerun ${attempt}: retrying ${pluralize(testResults.length, "test")}`), this.#stdout);

    testResults.slice(0, 10).forEach((testResult) => {
      this.#printEventLine(`- ${testResult.fullName ?? testResult.name}`, this.#stdout);
    });

    if (testResults.length > 10) {
      this.#printEventLine(gray(`... and ${testResults.length - 10} more`), this.#stdout);
    }
  };

  printFinalSummary = async (params: { store: AllureStore; qualityGateResults?: QualityGateValidationResult[] }) => {
    this.#clearStatusLine();

    const qualityGateResults = params.qualityGateResults?.length ? params.qualityGateResults : this.#qualityGateResults;

    if (!this.shouldPrintFinalSummary) {
      if (!this.isSilent && qualityGateResults.length) {
        this.#printQualityGateSection(qualityGateResults);
      }
      return;
    }

    const testResults = await params.store.allTestResults({ includeHidden: false });
    const stats = testResults.length
      ? buildStatsFromResults(testResults)
      : await params.store.testsStatistic((tr) => !tr.hidden);
    const globalErrors = await params.store.allGlobalErrors();
    const stderrContent = await readGlobalStderr(params.store);
    const stderr = classifyStderr(stderrContent);
    const globalErrorIssues = summarizeGlobalErrorIssues(globalErrors);
    const runnerFailureSamples = [...globalErrorIssues, ...stderr.actionable].sort(
      (left, right) => right.count - left.count || left.message.localeCompare(right.message),
    );
    const totalDuration = sumDurations(testResults);
    const failedOrBroken = testResults.filter(
      (testResult) => testResult.status === "failed" || testResult.status === "broken",
    );
    const recoveredOnRerun = await this.#countRecoveredOnRerun(params.store, testResults);

    const summaryLines = [
      "",
      "Allure run summary",
      `Total tests: ${stats.total}`,
      `Tests: ${formatStatsCounters(stats) || gray("0 results")}`,
    ];

    if (totalDuration > 0) {
      summaryLines.push(`Duration: ${yellow(formatDuration(totalDuration))}`);
    }

    if (this.#rerunAttempts.length > 0) {
      summaryLines.push(`Reruns: ${this.#rerunAttempts.length}`);
    }

    if (recoveredOnRerun > 0) {
      summaryLines.push(`Recovered on rerun: ${green(String(recoveredOnRerun))}`);
    }

    if (stats.total === 0) {
      summaryLines.push(
        globalErrors.length > 0 || stderr.actionable.length > 0
          ? red("No visible test results were produced. Review runner-level errors below.")
          : yellow("No visible test results were produced."),
      );
    }

    if (failedOrBroken.length > 0) {
      summaryLines.push("");
      summaryLines.push("Failed / broken tests:");

      limitLines(
        failedOrBroken.map((testResult) => `- ${formatTestHighlight(testResult)}`),
        10,
      ).forEach((line) => summaryLines.push(line));
    }

    if (runnerFailureSamples.length > 0) {
      summaryLines.push("");
      summaryLines.push(
        red(
          `Partial runtime review: ${pluralize(runnerFailureSamples.length, "runner-level error")} occurred outside logical tests.`,
        ),
      );
      summaryLines.push("Runner errors:");

      limitLines(
        runnerFailureSamples.map((issue) => `- ${issue.message}`),
        5,
      ).forEach((line) => summaryLines.push(line));
    }

    summaryLines.forEach((line) => this.#printEventLine(line, this.#stdout));

    if (qualityGateResults.length) {
      this.#printQualityGateSection(qualityGateResults);
    }
  };

  async #handleTestResults(testResultIds: string[]) {
    if (!this.#store) {
      return;
    }

    const testResults = (
      await Promise.all(testResultIds.map((testResultId) => this.#store!.testResultById(testResultId)))
    ).filter((testResult): testResult is TestResult => testResult !== undefined && !testResult.hidden);

    if (PROGRESS_MODES.has(this.#mode)) {
      await this.#renderProgressLine();
    }

    if (!LIVE_ERROR_MODES.has(this.#mode)) {
      return;
    }

    testResults.forEach((testResult) => {
      if (this.#seenHighlights.has(testResult.id)) {
        return;
      }

      const shouldHighlight =
        testResult.status === "failed" ||
        testResult.status === "broken" ||
        (this.#mode === "rich" && testResult.status === "skipped");

      if (!shouldHighlight) {
        return;
      }

      this.#seenHighlights.add(testResult.id);
      this.#printEventLine(formatTestHighlight(testResult), this.#stdout);
    });
  }

  async #renderProgressLine() {
    if (!this.#store || !PROGRESS_MODES.has(this.#mode)) {
      return;
    }

    const stats = await this.#store.testsStatistic((testResult) => !testResult.hidden);
    const nextLine = formatProgressLine(stats);

    if (nextLine === this.#latestProgressLine) {
      return;
    }

    this.#latestProgressLine = nextLine;
    this.#renderStatusLine(nextLine);
  }

  async #countRecoveredOnRerun(store: AllureStore, testResults: TestResult[]) {
    const retriesByResult = await Promise.all(testResults.map((testResult) => store.retriesByTr(testResult)));

    return testResults.reduce((acc, testResult, index) => {
      if (testResult.status !== "passed") {
        return acc;
      }

      return retriesByResult[index]?.some((retry) => retry.status === "failed" || retry.status === "broken")
        ? acc + 1
        : acc;
    }, 0);
  }

  #printQualityGateSection(results: QualityGateValidationResult[]) {
    this.#printEventLine("", this.#stdout);
    this.#printEventLine(red("Quality gate:"), this.#stdout);
    results
      .flatMap((result) => result.message.split("\n"))
      .forEach((line) => {
        this.#printEventLine(line, this.#stdout);
      });
  }

  #renderStatusLine(line: string) {
    if (!this.#stdout.isTTY || this.isSilent) {
      this.#printEventLine(line, this.#stdout);
      return;
    }

    clearLine(asWritableStream(this.#stdout), 0);
    cursorTo(asWritableStream(this.#stdout), 0);
    this.#stdout.write(line);
    this.#statusLineVisible = true;
  }

  #clearStatusLine() {
    if (!this.#stdout.isTTY || !this.#statusLineVisible) {
      return;
    }

    clearLine(asWritableStream(this.#stdout), 0);
    cursorTo(asWritableStream(this.#stdout), 0);
    this.#statusLineVisible = false;
  }

  #restoreStatusLine() {
    if (!this.#stdout.isTTY || !this.#statusLineVisible || !this.#latestProgressLine) {
      return;
    }

    this.#stdout.write(this.#latestProgressLine);
  }

  #printEventLine(line: string, stream: OutputStream) {
    if (this.isSilent) {
      return;
    }

    const hadStatusLine = this.#statusLineVisible;

    if (hadStatusLine) {
      this.#clearStatusLine();
    }

    stream.write(`${line}\n`);

    if (hadStatusLine) {
      this.#restoreStatusLine();
    }
  }
}
