import type { AllureHistory, HistoryDataPoint } from "@allurereport/core-api";

import type { AllureServiceClient } from "./service.js";
import { KnownError } from "./utils/http.js";

const normalizeHistoryDataPointUrls = (historyDataPoint: HistoryDataPoint): HistoryDataPoint => {
  const { url } = historyDataPoint;

  if (!url) {
    return historyDataPoint;
  }

  let testResults = historyDataPoint.testResults;

  for (const [historyId, historyTestResult] of Object.entries(historyDataPoint.testResults)) {
    if (historyTestResult.url) {
      continue;
    }

    if (testResults === historyDataPoint.testResults) {
      testResults = { ...historyDataPoint.testResults };
    }

    testResults[historyId] = {
      ...historyTestResult,
      url,
    };
  }

  if (testResults === historyDataPoint.testResults) {
    return historyDataPoint;
  }

  return {
    ...historyDataPoint,
    testResults,
  };
};

export class AllureRemoteHistory implements AllureHistory {
  constructor(readonly params: { allureServiceClient: AllureServiceClient; limit?: number; branch?: string }) {}

  async readHistory(params?: { branch?: string }) {
    const { limit } = this.params;

    try {
      const res = await this.params.allureServiceClient.downloadHistory({
        branch: params?.branch ?? this.params.branch,
        limit,
      });

      return res?.map(normalizeHistoryDataPointUrls);
    } catch (err) {
      if (err instanceof KnownError && err.status === 404) {
        return [];
      }

      throw err;
    }
  }

  async appendHistory() {
    // keep the method empty because we upload new remote history points when creating remote report
  }
}
