import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, expect, it, vi } from "vite-plus/test";

import type { BarChart } from "../BarChart/BarChart.js";
import { TestBaseGrowthDynamicsChartWidget } from "./index.js";

const { barChartMock } = vi.hoisted(() => ({
  barChartMock: vi.fn(),
}));

vi.mock("../BarChart/BarChart.js", () => ({
  BarChart: (props: Parameters<typeof BarChart>[0]) => {
    barChartMock(props);
    return <div data-testid="bar-chart" />;
  },
}));

afterEach(cleanup);

const noChange = {
  "new:broken": 0,
  "new:failed": 0,
  "new:passed": 0,
  "new:skipped": 0,
  "new:unknown": 0,
  "removed:broken": 0,
  "removed:failed": 0,
  "removed:passed": 0,
  "removed:skipped": 0,
  "removed:unknown": 0,
};

it("uses only selected statuses and keeps a zero comparison in the cumulative trend", () => {
  render(
    <TestBaseGrowthDynamicsChartWidget
      title="Test base growth"
      statuses={["passed"]}
      data={[
        { ...noChange, "id": "first", "timestamp": 100, "new:passed": 1, "removed:passed": 4, "new:failed": 10 },
        { ...noChange, id: "second", timestamp: 200 },
        { ...noChange, "id": "current", "timestamp": 300, "new:passed": 2 },
      ]}
      i18n={(key) => key}
    />,
  );

  expect(screen.getByTestId("bar-chart")).toBeTruthy();
  expect(barChartMock.mock.lastCall?.[0].data).toMatchObject([
    { id: "first", diffTrend: -3, cumulativeTrend: -1 },
    { id: "second", diffTrend: 0, cumulativeTrend: -1 },
    { id: "current", diffTrend: 2, cumulativeTrend: -1 / 3 },
  ]);
});
