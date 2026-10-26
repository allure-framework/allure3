import type { TestResult } from "@allurereport/core-api";

import type { ClassicOptions } from "./model.js";

type Writer = {
  writeWidget(fileName: string, data: any): Promise<void>;
};

export type ClassicTimelineTr = Pick<
  TestResult,
  "id" | "name" | "status" | "flaky" | "isRetry" | "environment" | "start" | "duration" | "retryHash"
> & {
  host: string;
  thread: string;
};

const DEFAULT_MIN_DURATION = 1;

const findLabelValue = (test: TestResult, name: string) => test.labels?.find((label) => label.name === name)?.value;

/**
 * Builds timeline items grouped later in the UI by host and thread, like the Allure 2 timeline.
 * Tests without start/stop timestamps, host or thread labels, or shorter than `minDuration` are skipped.
 */
export const createTimelineData = (trs: TestResult[], options: Pick<ClassicOptions, "timeline"> = {}) => {
  const minDuration = options.timeline?.minDuration ?? DEFAULT_MIN_DURATION;
  const result: ClassicTimelineTr[] = [];

  for (const test of trs) {
    if (!Number.isInteger(test.start) || !Number.isInteger(test.stop)) {
      continue;
    }

    const duration = test.duration ?? test.stop! - test.start!;

    if (duration < minDuration) {
      continue;
    }

    const host = findLabelValue(test, "host");
    const thread = findLabelValue(test, "thread");

    if (!host?.length || !thread?.length) {
      continue;
    }

    result.push({
      id: test.id,
      retryHash: test.retryHash,
      name: test.name,
      status: test.status,
      flaky: test.flaky,
      isRetry: test.isRetry,
      environment: test.environment,
      host,
      thread,
      start: test.start,
      duration,
    });
  }

  return result;
};

export const generateTimeline = async (
  writer: Writer,
  trs: TestResult[],
  options: Pick<ClassicOptions, "timeline"> = {},
) => {
  await writer.writeWidget("timeline.json", createTimelineData(trs, options));
};
