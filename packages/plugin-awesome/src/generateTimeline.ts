import type { TestResult } from "@allurereport/core-api";

import type { AwesomeOptions } from "./model.js";

type Writer = {
  writeWidget(fileName: string, data: any): Promise<void>;
};

const DEFAULT_MIN_DURATION = 1;

type TimelineTr = Pick<
  TestResult,
  "id" | "name" | "status" | "hidden" | "environment" | "start" | "duration" | "historyId"
> & {
  environmentName?: string;
  host: string;
  thread: string;
};

const DEFAULT_TIMELINE_OPTIONS = {
  minDuration: DEFAULT_MIN_DURATION,
} as const;

export const generateTimeline = async (
  writer: Writer,
  trs: TestResult[],
  options: AwesomeOptions,
  environmentIdByTrId: Map<string, string>,
) => {
  const { timeline = DEFAULT_TIMELINE_OPTIONS } = options;
  const { minDuration = DEFAULT_MIN_DURATION } = timeline;

  const result: TimelineTr[] = [];

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
      environment: environmentIdByTrId.get(test.id) ?? test.environment,
      environmentName: test.environment,
      start: test.start,
      duration,
    });
  }

  await writer.writeWidget("timeline.json", result);
};
