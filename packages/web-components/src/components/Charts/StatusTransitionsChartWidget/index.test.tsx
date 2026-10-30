import { cleanup, render, screen } from "@testing-library/preact";
import { allureId, epic, feature, label, story } from "allure-js-commons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { barChartMock } = vi.hoisted(() => ({
  barChartMock: vi.fn(),
}));

vi.mock("../BarChart/BarChart.js", () => ({
  BarChart: (props: unknown) => {
    barChartMock(props);
    return <div data-testid="bar-chart" />;
  },
}));

import { StatusTransitionsChartWidget } from ".";
import type { Props } from "./types";

const i18n: Props["i18n"] = (key, props) => (props ? `${key}:${String(props.timestamp)}` : key);
const renderWidget = (data: Props["data"]) =>
  render(<StatusTransitionsChartWidget title="Status transitions" data={data} i18n={i18n} />);
const lastBarChartProps = () => barChartMock.mock.calls.at(-1)?.[0] as Record<string, any>;

beforeEach(async () => {
  await epic("coverage");
  await feature("charts");
  await story("status-transitions");
  await label("coverage", "status-transitions");
  barChartMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("StatusTransitionsChartWidget", () => {
  it("should render diverging bars, legend, trend, and time labels", async () => {
    await allureId("304050");
    renderWidget([
      { id: "history", timestamp: 100, prevItemTimestamp: 0, fixed: 2, regressed: 1, malfunctioned: 1 },
      { id: "current", timestamp: 200, prevItemTimestamp: 100, fixed: 3, regressed: 2, malfunctioned: 0 },
    ]);

    expect(screen.getByTestId("bar-chart")).toBeTruthy();
    const props = lastBarChartProps();

    expect(props.data).toEqual([
      expect.objectContaining({ id: "history", fixed: 2, regressed: -1, malfunctioned: -1 }),
      expect.objectContaining({ id: "current", fixed: 3, regressed: -2, malfunctioned: 0 }),
    ]);
    expect(props.legend.map(({ id, label }: { id: string; label: string }) => ({ id, label }))).toEqual([
      { id: "fixed", label: "transitions.fixed" },
      { id: "regressed", label: "transitions.regressed" },
      { id: "malfunctioned", label: "transitions.malfunctioned" },
      { id: "trend", label: "legend.trend" },
    ]);
    expect(props.minValue).toBe(-6);
    expect(props.maxValue).toBe(6);
    expect(props.formatLegendValue({ id: "regressed", value: -12 })).toBe("12");
    expect(props.formatLegendValue({ id: "trend", value: 0.25 })).toBe("");
    expect(props.formatTrendValue(-1)).toBeUndefined();
    expect(props.formatTrendValue(0.25)).toBe(0.25);
    expect(props.formatBottomTick("history")).toBe("ticks.history:100");
    expect(props.formatBottomTick("current")).toBe("ticks.current");
    expect(props.formatIndexBy({ id: "history", timestamp: 100 })).toBe("tooltips.history:100");
    expect(props.formatIndexBy({ id: "current", timestamp: 200 })).toBe("tooltips.current");
    expect(props.formatLeftTick(-2)).toBe("2");
    expect(props.formatLeftTick(0.5)).toBe("");
  });

  it("should distinguish no-results and no-history states", async () => {
    await allureId("304051");
    const noResults = renderWidget([
      { id: "current", timestamp: 200, prevItemTimestamp: 0, fixed: 0, regressed: 0, malfunctioned: 0 },
    ]);

    expect(screen.getByText("no-results")).toBeTruthy();
    expect(screen.queryByTestId("bar-chart")).toBeNull();

    noResults.unmount();
    const noHistory = renderWidget([
      { id: "history", timestamp: 100, prevItemTimestamp: 0, fixed: 0, regressed: 0, malfunctioned: 0 },
      { id: "current", timestamp: 200, prevItemTimestamp: 100, fixed: 1, regressed: 0, malfunctioned: 0 },
    ]);

    expect(screen.getByText("no-history")).toBeTruthy();
    expect(screen.queryByTestId("bar-chart")).toBeNull();

    noHistory.unmount();
    renderWidget([
      { id: "history", timestamp: 100, prevItemTimestamp: 0, fixed: 0, regressed: 1, malfunctioned: 0 },
      { id: "current", timestamp: 200, prevItemTimestamp: 100, fixed: 1, regressed: 0, malfunctioned: 0 },
    ]);

    expect(screen.getByTestId("bar-chart")).toBeTruthy();
    expect(screen.queryByText("no-history")).toBeNull();
    expect(screen.queryByText("no-results")).toBeNull();
  });
});
