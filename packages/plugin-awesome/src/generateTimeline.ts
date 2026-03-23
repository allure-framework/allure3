import type { TestResult } from "@allurereport/core-api";

import type { AwesomeOptions } from "./model.js";

type Writer = {
  writeWidget(fileName: string, data: any): Promise<void>;
};

const DEFAULT_MIN_DURATION = 1;

type TimlineTr = Pick<
  TestResult,
  "id" | "name" | "status" | "hidden" | "environment" | "start" | "stop" | "duration" | "historyId"
> & {
  environmentName?: string;
  host: string;
  thread: string;
};

type TimelineSourceTestResult = TestResult & {
  environmentId?: string;
};

const DEFAULT_TIMELINE_OPTIONS = {
  minDuration: DEFAULT_MIN_DURATION,
} as const;

export const generateTimeline = async (writer: Writer, trs: TimelineSourceTestResult[], options: AwesomeOptions) => {
  const { timeline = DEFAULT_TIMELINE_OPTIONS } = options;
  const { minDuration = DEFAULT_MIN_DURATION } = timeline;

  const result: TimlineTr[] = [];

  for (const test of trs) {
    const hasStart = Number.isInteger(test.start);
    const hasStop = Number.isInteger(test.stop);

    if (!hasStart || !hasStop) {
      continue;
    }

    const duration = test.duration ?? test.stop! - test.start!;

    if (duration < minDuration) {
      continue;
    }

    const host = test.labels?.find(({ name }) => name === "host")?.value;
    const thread = test.labels?.find(({ name }) => name === "thread")?.value;

    if (!host?.length || !thread?.length) {
      continue;
    }

    result.push({
      id: test.id,
      historyId: test.historyId,
      name: test.name,
      status: test.status,
      hidden: test.hidden,
      host,
      thread,
      environment: test.environmentId ?? test.environment,
      environmentName: test.environment,
      start: test.start,
      duration,
    });
  }

  await writer.writeWidget("timeline.json", result);
};
