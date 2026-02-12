import type { TestResult } from "@allurereport/core-api";
import type { AwesomeTestResult } from "@allurereport/web-awesome";
import type { AwesomeOptions } from "./model.js";

type Writer = {
  writeWidget(fileName: string, data: any): Promise<void>;
};

const DEFAULT_MIN_DURATION = 1;

type TimlineTr = Pick<
  TestResult,
  "id" | "name" | "status" | "hidden" | "environment" | "start" | "stop" | "duration" | "historyId"
> & {
  host: string;
  thread: string;
};

const DEFAULT_TIMELINE_OPTIONS = {
  minDuration: DEFAULT_MIN_DURATION,
} as const;

export const generateTimeline = async (writer: Writer, trs: AwesomeTestResult[], options: AwesomeOptions) => {
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

    const { host, thread } = test.groupedLabels;

    if (!host?.length || !thread?.length) {
      continue;
    }

    result.push({
      id: test.id,
      historyId: test.historyId,
      name: test.name,
      status: test.status,
      hidden: test.hidden,
      host: host[0],
      thread: thread[0],
      environment: test.environment,
      start: test.start,
      duration,
    });
  }

  await writer.writeWidget("timeline.json", result);
};
