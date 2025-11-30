import type { TestResult } from "@allurereport/core-api";
import type { AllureStore } from "@allurereport/plugin-api";
import { hasLabels } from "@allurereport/web-commons";
import type { AwesomeOptions } from "./model.js";

type Writer = {
  writeWidget(fileName: string, data: any): Promise<void>;
};

const DEFAULT_MIN_DURATION = 1;
const HOST_LABEL = "host";
const THREAD_LABEL = "thread";

export const generateTimeline = async (writer: Writer, store: AllureStore, options: AwesomeOptions) => {
  if (!options.timeline) {
    return;
  }
  const testResults = await store.allTestResults();

  const { minDuration = DEFAULT_MIN_DURATION } = options.timeline;
  const result: TestResult[] = [];

  for (const test of testResults) {
    const hasStart = Number.isInteger(test.start);
    const hasStop = Number.isInteger(test.stop);

    if (!hasStart || !hasStop) {
      continue;
    }

    const duration = test.duration ?? test.stop! - test.start!;

    if (duration < minDuration) {
      continue;
    }

    if (!hasLabels(test, [HOST_LABEL, THREAD_LABEL])) {
      continue;
    }

    result.push(test);
  }

  await writer.writeWidget("timeline.json", result);
};
