import type { TestResult } from "@allurereport/core-api";

export type TimelineTr = Pick<
  TestResult,
  "id" | "name" | "status" | "flaky" | "isRetry" | "environment" | "start" | "duration" | "retryHash"
> & {
  environmentName?: string;
  host: string;
  thread: string;
};

export type TimelineOptions = {
  /** Test results shorter than this are skipped. Default: 1 */
  minDuration?: number;
  /**
   * Environment ids and names to write instead of the raw `environment` value.
   * Without it, items carry the result's own `environment` and no `environmentName`.
   */
  environments?: {
    idByTrId: Map<string, string>;
    nameById?: Map<string, string>;
  };
};

type TimelineWriter = {
  writeWidget(fileName: string, data: any): Promise<void>;
};

const DEFAULT_MIN_DURATION = 1;

const findLabelValue = (test: TestResult, name: string) => test.labels?.find((label) => label.name === name)?.value;

/**
 * Builds timeline items grouped later in the UI by host and thread.
 * Tests without start/stop timestamps, host or thread labels, or shorter than `minDuration` are skipped.
 */
export const createTimelineData = (trs: TestResult[], options: TimelineOptions = {}): TimelineTr[] => {
  const { minDuration = DEFAULT_MIN_DURATION, environments } = options;
  const result: TimelineTr[] = [];

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

    const item: TimelineTr = {
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
    };

    if (environments) {
      item.environment = environments.idByTrId.get(test.id) ?? test.environment;
      item.environmentName = environments.nameById?.get(test.environment ?? "") ?? test.environment;
    }

    result.push(item);
  }

  return result;
};

export const generateTimeline = async (writer: TimelineWriter, trs: TestResult[], options: TimelineOptions = {}) => {
  await writer.writeWidget("timeline.json", createTimelineData(trs, options));
};
