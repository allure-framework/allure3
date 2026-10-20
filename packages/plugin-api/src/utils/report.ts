import {
  type HistoryDataPoint,
  type TestFixtureResult,
  type TestStepResult,
  isStep,
  redactParameters,
} from "@allurereport/core-api";

import type { ReportFixtureResult, ReportTestStepResult } from "../report.js";
import type { AllureStore } from "../store.js";

const HISTORY_DATA_POINT_LIMIT = 6;

export const writeConcurrently = async <T>(
  items: readonly T[],
  write: (item: T) => Promise<void>,
  concurrency = 64,
) => {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(write));
  }
};

export const convertTestStepResult = (tsr: TestStepResult): ReportTestStepResult => {
  if (isStep(tsr)) {
    return {
      ...tsr,
      parameters: redactParameters(tsr.parameters),
      steps: (tsr.steps ?? []).map(convertTestStepResult),
    };
  }

  return tsr;
};

export const convertFixtureResult = (fr: TestFixtureResult): ReportFixtureResult => {
  return {
    id: fr.id,
    type: fr.type,
    name: fr.name,
    status: fr.status,
    steps: fr.steps.map(convertTestStepResult),
    duration: fr.duration,
  };
};

export const generateHistoryDataPoints = async (
  writer: { writeData: (fileName: string, data: HistoryDataPoint) => Promise<void> },
  store: Pick<AllureStore, "allHistoryDataPoints">,
): Promise<void> => {
  const allHistoryPoints = await store.allHistoryDataPoints();

  // Preserve sequential writes: a failure must prevent later history files from starting.
  for (const historyPoint of allHistoryPoints.slice(0, HISTORY_DATA_POINT_LIMIT)) {
    await writer.writeData(`history/${historyPoint.uuid}.json`, historyPoint);
  }
};
