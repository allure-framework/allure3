import {
  type AllureChartsStoreData,
  ChartType,
  DEFAULT_CHART_HISTORY_LIMIT,
  type StatusTransitionsChartData,
  type StatusTransitionsChartOptions,
} from "@allurereport/charts-api";
import type { HistoryDataPoint, HistoryTestResult, TestResult, TestStatusTransition } from "@allurereport/core-api";
import { htrsByTr } from "@allurereport/core-api";
import { limitHistoryDataPoints } from "./chart-utils.js";

type TrWithStatusAndTransition = Pick<TestResult, "status" | "transition" | "start">;

const getLastSignificantStatus = (history: TrWithStatusAndTransition[] = []): string | undefined => {
  const significantHtr = [...history]
    // Sort by start descending, so latest first and earliest last
    .sort((a, b) => (b.start ?? 0) - (a.start ?? 0))
    .find((htr: TrWithStatusAndTransition) => htr.status !== "unknown" && htr.status !== "skipped");

  return significantHtr?.status;
};

const getStatusTransition = (
  tr: TrWithStatusAndTransition,
  history: TrWithStatusAndTransition[] = [],
): TestStatusTransition | undefined => {
  if (history.length === 0) {
    return "new";
  }

  if (tr.transition) {
    return tr.transition;
  }

  const lastStatus = getLastSignificantStatus(history);

  if (lastStatus === tr.status) {
    return;
  }

  switch (tr.status) {
    case "passed":
      return "fixed";
    case "failed":
      return "regressed";
    case "broken":
      return "malfunctioned";
  }
};

type DataItem = {
  id: string | "current";
  timestamp: number;
  prevItemTimestamp: number;
  /**
   * A previously "failed" or "broken" test that is now "passed"
   */
  fixed: number;
  /**
   * A previously "passed" or "broken" test that is now "failed"
   */
  regressed: number;
  /**
   * A previously "passed" or "failed" test that is now "broken"
   */
  malfunctioned: number;
};

export const generateStatusTransitionsChart = (props: {
  options: StatusTransitionsChartOptions;
  storeData: AllureChartsStoreData;
}): StatusTransitionsChartData => {
  const { options, storeData } = props;
  const { limit = DEFAULT_CHART_HISTORY_LIMIT } = options;
  const { historyDataPoints, testResults } = storeData;

  const limitedHdps = limitHistoryDataPoints(historyDataPoints, limit).sort(
    // Sort by timestamp ascending, so earliest first and latest last
    (a, b) => a.timestamp - b.timestamp,
  );

  const currentReportTimestamp = testResults.reduce((acc, testResult) => Math.max(acc, testResult.stop ?? 0), 0);

  if (limitedHdps.length === 0) {
    return {
      type: ChartType.StatusTransitions,
      title: options.title,
      data: [
        {
          id: "current",
          timestamp: currentReportTimestamp,
          prevItemTimestamp: 0,
          fixed: 0,
          regressed: 0,
          malfunctioned: 0,
        },
      ],
    };
  }

  const [earliestHdp, ...hdps] = limitedHdps;

  const data: DataItem[] = [];

  [
    ...hdps,
    {
      testResults: testResults.reduce(
        (acc, testResult) => {
          acc[testResult.historyId ?? testResult.id] = testResult;
          return acc;
        },
        {} as Record<string, TestResult>,
      ),
      uuid: "current",
      timestamp: currentReportTimestamp,
    },
  ].forEach(({ testResults: trs, uuid, timestamp }, index, dataPoints) => {
    const hpsPriorToCurrent = index === 0 ? [earliestHdp] : dataPoints.slice(0, index);
    const latestHpPriorToCurrent = hpsPriorToCurrent[hpsPriorToCurrent.length - 1];

    const newDataItem: DataItem = {
      id: uuid,
      timestamp,
      prevItemTimestamp: latestHpPriorToCurrent.timestamp,
      fixed: 0,
      regressed: 0,
      malfunctioned: 0,
    };

    data.push(newDataItem);

    const cTrs: (TestResult | HistoryTestResult)[] = Object.values(trs);

    for (const cTr of cTrs) {
      // Compare only to latest history point, as we don't know the previous history
      const htrs = htrsByTr(hpsPriorToCurrent as HistoryDataPoint[], cTr);

      const transition = getStatusTransition(cTr, htrs);

      if (!transition || transition === "new") {
        continue;
      }

      newDataItem[transition]++;
    }
  });

  return {
    type: ChartType.StatusTransitions,
    title: options.title,
    data,
  };
};
