import type { BarGroup, HistoryDataPoint, HistoryTestResult, TestResult, TestStatus } from "@allurereport/core-api";
import { BarGroupMode } from "@allurereport/core-api";
import { createEmptyStats, type BarDataAccessor } from "../../charts.js";

const groupKeys = ["passed", "failed", "broken", "unknown"] as const;

const getSignedValueByStatus = (status: TestStatus): number => {
    return ["passed", "failed"].includes(status) ? 1 : -1;
};

const getPointStats = (testResults: (TestResult | HistoryTestResult)[]): Record<TestStatus, number> => testResults.reduce((acc, testResult) => {
    if (testResult.status) {
        acc[testResult.status] = acc[testResult.status] + getSignedValueByStatus(testResult.status);
    }

    return acc;
}, createEmptyStats<TestStatus>(groupKeys));

const sumStats = (stats1: Record<TestStatus, number>, stats2: Record<TestStatus, number>): Record<TestStatus, number> => {
    return groupKeys.reduce((acc, key) => {
        acc[key] = stats1[key] ?? 0 + stats2[key] ?? 0;

        return acc;
    }, createEmptyStats<TestStatus>(groupKeys));
};

const makeCumulativeStats = (stats: BarGroup<string, TestStatus>[]): BarGroup<string, TestStatus>[] => {
    let cumulativeStats = createEmptyStats<TestStatus>(groupKeys);

    // TODO: check the correctness of the order and correctness of cumulative stats calculations
    return stats.reduce((acc, statsItem) => {
        cumulativeStats = sumStats(cumulativeStats, statsItem);

        acc.push({
            ...statsItem,
            ...cumulativeStats,
        });

        return acc;
    }, [] as BarGroup<string, TestStatus>[]);
};

const getHistoricalStats = (limitedHdps: HistoryDataPoint[]): BarGroup<string, TestStatus>[] => {
    return limitedHdps.reduce((acc, hdp, index) => {
        return {
            ...acc,
            [index]: {
                groupId: `Point ${limitedHdps.length - index - 1}`,
                ...getPointStats(Object.values(hdp.testResults)),
            },
        };
    }, [] as BarGroup<string, TestStatus>[]);
};

const getCurrentStats = (testResults: TestResult[]): BarGroup<string, TestStatus> => {
    return {
        groupId: "current",
        ...getPointStats(testResults),
    };
};

const getTrendData = (testResults: TestResult[], limitedHdps: HistoryDataPoint[], isCumulative = false): BarGroup<string, TestStatus>[] => {
    let historicalStats = getHistoricalStats(limitedHdps);
    const currentStats = getCurrentStats(testResults);

    if (isCumulative) {
        historicalStats = makeCumulativeStats(historicalStats);
    }

    return [currentStats, ...historicalStats];
};

export const sfbuTrendAccessor: BarDataAccessor<string, TestStatus> = {
    getItems: ({ testResults }, limitedHdps, isFullHistory, isCumulative = false) => {
        let trendData = getTrendData(testResults, limitedHdps, isCumulative);

        /* This is necessary not to exclude the last point that have been compared with the empty stats if the history is fully provided.
        *
        * We have no previous point at the end of the full history, that's why we have to compare it with the empty stats.
        * At the opposite, we have to exclude the last point if the history is limited because it should be compared with the real previous point,
        * but it is already excluded in limited history.
        */
        if (!isFullHistory) {
        trendData = trendData.slice(0, -1);
        }

        return trendData.reverse();
    },
    getGroupKeys: () => groupKeys,
    getGroupMode: () => BarGroupMode.Stacked,
};
