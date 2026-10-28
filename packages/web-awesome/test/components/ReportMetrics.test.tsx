import { cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ReportMetrics } from "@/components/ReportMetrics";
import { metricsStore, type MetricsWidgetData } from "@/stores/metrics";

vi.mock("@/stores", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  metricsStore.value = { loading: true, error: undefined, data: undefined };
});

const showMetrics = (value: number, unit?: string, history: MetricsWidgetData["history"] = []) => {
  const data: MetricsWidgetData = {
    current: [
      {
        id: "sample",
        key: "size",
        title: "Attachment size",
        value,
        unit,
        source: "attachments-perf.json",
        better: "lower",
        start: 1,
        stop: 2,
      },
    ],
    history,
  };
  metricsStore.value = { loading: false, error: undefined, data };
  render(<ReportMetrics />);
  return data;
};

describe("components > ReportMetrics", () => {
  it("formats byte values and signed deltas throughout summary, history and current values", () => {
    const data = showMetrics(911140972, "bytes", [
      { uuid: "older", name: "Older", timestamp: 1, url: "https://example.com/older", metrics: { size: 929439110 } },
      {
        uuid: "previous",
        name: "Previous",
        timestamp: 2,
        url: "https://example.com/previous",
        metrics: { size: 920766553 },
      },
    ]);
    expect(screen.getByTestId("metrics-view")).toBeInTheDocument();
    const summary = within(screen.getByRole("region", { name: "metrics.phaseSummary" }))
      .getByRole("button", { name: "Attachment size" })
      .closest("tr")!;
    expect(within(summary).getAllByText("868.93 MiB")).toHaveLength(4);
    expect(within(summary).getByText("-9.18 MiB").closest("span")).toHaveAttribute("data-direction", "good");
    expect(summary.querySelector("polyline")).toBeInTheDocument();

    fireEvent.click(within(summary).getByRole("button"));
    const history = screen.getByRole("region", { name: "metrics.historyTitle Attachment size" });
    expect(within(history).getByText("868.93 MiB")).toBeInTheDocument();
    expect(within(history).getByText("886.38 MiB")).toBeInTheDocument();
    expect(within(history).getByText("878.11 MiB")).toBeInTheDocument();
    expect(within(history).getByText("-8.27 MiB")).toBeInTheDocument();
    expect(within(history).getByRole("link", { name: "Previous" })).toHaveAttribute(
      "href",
      "https://example.com/previous",
    );

    fireEvent.click(screen.getByText("metrics.currentValues"));
    expect(screen.getAllByText("868.93 MiB")).toHaveLength(6);
    expect(screen.getByText("attachments-perf.json")).toBeInTheDocument();
    expect(data.current[0].value).toBe(911140972);
    expect(data.current[0].unit).toBe("bytes");
    expect(data.history[1].metrics.size).toBe(920766553);
  });

  it.each([
    [0, "bytes", "0 B"],
    [512, "bytes", "512 B"],
    [1024, "bytes", "1 KiB"],
    [1048576, "bytes", "1 MiB"],
    [1073741824, "bytes", "1 GiB"],
    [12.3456, "ms", "12.346 ms"],
    [42, undefined, "42"],
  ])("formats %s %s without changing other units", (value, unit, expected) => {
    showMetrics(value, unit);
    const summary = within(screen.getByRole("region", { name: "metrics.phaseSummary" }))
      .getByRole("button", { name: "Attachment size" })
      .closest("tr")!;
    expect(within(summary).getAllByText(expected)).toHaveLength(4);
    expect(within(summary).getByText("1")).toBeInTheDocument();
  });

  it("keeps the positive sign when a byte delta crosses the KiB boundary", () => {
    showMetrics(2048, "bytes", [{ uuid: "previous", name: "Previous", timestamp: 1, metrics: { size: 1024 } }]);
    expect(screen.getAllByText("+1 KiB")).toHaveLength(2);
  });

  it("styles lower, higher, and neutral deltas and shows the no-history state", () => {
    const sample = (key: string, value: number, better: "lower" | "higher" | "neutral") => ({
      id: key,
      key,
      title: key,
      value,
      better,
      start: 0,
      stop: 1,
    });
    metricsStore.value = {
      loading: false,
      error: undefined,
      data: {
        current: [
          sample("lower-improvement", 8, "lower"),
          sample("higher-improvement", 12, "higher"),
          sample("lower-regression", 12, "lower"),
          sample("higher-regression", 8, "higher"),
          sample("neutral-change", 12, "neutral"),
          sample("no-history", 5, "lower"),
        ],
        history: [
          {
            uuid: "previous",
            name: "Previous",
            timestamp: 1,
            metrics: {
              "lower-improvement": 10,
              "higher-improvement": 10,
              "lower-regression": 10,
              "higher-regression": 10,
              "neutral-change": 10,
            },
          },
        ],
      },
    };
    render(<ReportMetrics />);

    const summary = screen.getByRole("region", { name: "metrics.phaseSummary" });
    const expectDirection = (metric: string, direction: string) => {
      const row = within(summary).getByRole("button", { name: metric }).closest("tr")!;

      expect(row.querySelector(`[data-direction="${direction}"]`)).toBeInTheDocument();
    };

    expectDirection("lower-improvement", "good");
    expectDirection("higher-improvement", "good");
    expectDirection("lower-regression", "bad");
    expectDirection("higher-regression", "bad");
    expectDirection("neutral-change", "neutral");

    fireEvent.click(within(summary).getByRole("button", { name: "no-history" }));
    expect(screen.getByText("metrics.noHistory")).toBeInTheDocument();
  });

  it("renders loading, empty, missing, and fetch-error states", () => {
    const view = render(<ReportMetrics />);
    expect(view.container.querySelector("svg")).toBeInTheDocument();

    metricsStore.value = { loading: false, error: undefined, data: { current: [], history: [] } };
    view.rerender(<ReportMetrics />);
    expect(screen.getByText("no-metrics-results")).toBeInTheDocument();

    metricsStore.value = { loading: false, error: undefined, data: undefined };
    view.rerender(<ReportMetrics />);
    expect(view.container).toBeEmptyDOMElement();

    metricsStore.value = { loading: false, error: "metrics fetch failed", data: undefined };
    view.rerender(<ReportMetrics />);
    expect(screen.getByText("metrics fetch failed")).toBeInTheDocument();
  });
});
