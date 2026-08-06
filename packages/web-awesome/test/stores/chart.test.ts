import type { PieChartValues } from "@allurereport/charts-api";
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

import { fetchPieChartData, pieChartStore } from "../../src/stores/chart.js";

describe("stores > chart", () => {
  beforeEach(() => {
    fetchReportJsonDataMock.mockReset();
    pieChartStore.value = {
      loading: true,
      error: undefined,
      data: undefined,
    };
  });

  it("should fetch root pie chart data from the generated pie chart widget", async () => {
    const pieChart: PieChartValues = {
      percentage: 50,
      slices: [
        { status: "passed", count: 1 },
        { status: "failed", count: 1 },
      ],
    };

    fetchReportJsonDataMock.mockResolvedValue(pieChart);

    await fetchPieChartData("");

    expect(fetchReportJsonDataMock).toHaveBeenCalledWith("widgets/pie_chart.json", { bustCache: true });
    expect(pieChartStore.value).toEqual({
      data: pieChart,
      error: undefined,
      loading: false,
    });
  });

  it("should fetch environment pie chart data from the generated environment pie chart widget", async () => {
    const pieChart: PieChartValues = {
      percentage: 100,
      slices: [{ status: "passed", count: 1 }],
    };

    fetchReportJsonDataMock.mockResolvedValue(pieChart);

    await fetchPieChartData("staging");

    expect(fetchReportJsonDataMock).toHaveBeenCalledWith("widgets/staging/pie_chart.json", { bustCache: true });
    expect(pieChartStore.value.data).toEqual(pieChart);
  });
});
