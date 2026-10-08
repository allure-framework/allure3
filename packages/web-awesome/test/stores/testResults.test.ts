import { epic, feature, label, story } from "allure-js-commons";
import type { ReportTestResult } from "types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchReportJsonDataMock } = vi.hoisted(() => ({
  fetchReportJsonDataMock: vi.fn(),
}));

vi.mock("@allurereport/web-commons", async () => {
  const actual = await vi.importActual<typeof import("@allurereport/web-commons")>("@allurereport/web-commons");

  return {
    ...actual,
    fetchReportJsonData: fetchReportJsonDataMock,
  };
});

import { fetchTestResult, testResultStore } from "@/stores/testResults";

const testResult = (id: string) =>
  ({
    id,
    name: `Test ${id}`,
    fullName: `Test ${id}`,
    status: "passed",
    labels: [],
    links: [],
    parameters: [],
    steps: [],
    fixtures: [],
    retries: [],
  }) as unknown as ReportTestResult;

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-state");
  await story("testResults");
  await label("coverage", "ui-state");

  fetchReportJsonDataMock.mockReset();
  testResultStore.value = {
    loading: true,
    error: undefined,
    data: undefined,
  };
});

describe("fetchTestResult", () => {
  it("keeps cached result visible while force-refreshing it", async () => {
    testResultStore.value = {
      loading: false,
      error: undefined,
      data: {
        "tr-1": testResult("old"),
      },
    };
    fetchReportJsonDataMock.mockResolvedValue(testResult("new"));

    const promise = fetchTestResult("tr-1", { force: true });

    expect(testResultStore.value.loading).toBe(false);

    await promise;

    expect(fetchReportJsonDataMock).toHaveBeenCalledWith("data/test-results/tr-1.json", { bustCache: true });
    expect(testResultStore.value.loading).toBe(false);
    expect(testResultStore.value.data?.["tr-1"].id).toBe("new");
  });
});
