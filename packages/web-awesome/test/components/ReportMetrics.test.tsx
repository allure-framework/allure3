import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { ReportMetrics } from "@/components/ReportMetrics";
import { metricsStore, type MetricsWidgetData } from "@/stores/metrics";

vi.mock("@/stores", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  localStorage.removeItem("allure.metrics.favorites");
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
  const loadReport = (keys = ["build.duration", "bundle.size"]) => {
    metricsStore.value = {
      loading: false,
      data: {
        current: keys.map((key, index) => ({
          id: key,
          key,
          title: key === "bundle.size" ? "Installed footprint" : "Build duration",
          value: index + 1,
          start: 0,
          stop: 1,
          source: "ci-metric.json",
        })),
        history: [],
      },
    };
    return render(<ReportMetrics />);
  };

  it("pins a metric once in the summary and maintains focus independently of row expansion", () => {
    loadReport();
    const summary = within(screen.getByRole("region", { name: "metrics.phaseSummary" }));
    const star = within(summary.getByRole("button", { name: "Installed footprint" }).closest("tr")!).getByRole(
      "button",
      { name: "metrics.addFavorite" },
    );
    star.focus();
    fireEvent.click(star);
    const pinned = within(summary.getByRole("region", { name: "metrics.favorites" }));
    expect(summary.getAllByRole("heading", { level: 3 })[0]).toHaveTextContent("metrics.favorites");
    expect(summary.getAllByRole("button", { name: "Installed footprint" })).toHaveLength(1);
    expect(pinned.getByRole("button", { name: "Installed footprint" })).toHaveAttribute("aria-expanded", "false");
    expect(pinned.getByRole("button", { name: "metrics.removeFavorite" })).toHaveFocus();
    const toggle = screen.getByTestId("metrics-favorites");
    fireEvent.click(toggle);
    expect(summary.queryByRole("button", { name: "Build duration" })).not.toBeInTheDocument();
    fireEvent.click(pinned.getByRole("button", { name: "metrics.removeFavorite" }));
    expect(toggle).toHaveFocus();
    expect(screen.getByText("metrics.noFavorites")).toBeVisible();
  });

  it("searches names and keys in both tables and combines the query with favorites", async () => {
    localStorage.setItem("allure.metrics.favorites", JSON.stringify({ keys: ["bundle.size"], only: false }));
    loadReport();
    const summary = within(screen.getByRole("region", { name: "metrics.phaseSummary" }));
    const search = screen.getByRole("textbox", { name: "metrics.search" });
    fireEvent.input(search, { target: { value: "  FOOTPRINT " } });
    await waitFor(() => expect(summary.queryByRole("button", { name: "Build duration" })).not.toBeInTheDocument());
    const currentToggle = screen.getByText("metrics.currentValues");
    fireEvent.click(currentToggle);
    const current = currentToggle.closest("details")!;
    expect(within(current).getByText("Installed footprint")).toBeInTheDocument();
    expect(within(current).queryByText("Build duration")).not.toBeInTheDocument();
    fireEvent.input(search, { target: { value: "BUILD.DUR" } });
    await summary.findByRole("button", { name: "Build duration" });
    fireEvent.click(screen.getByTestId("metrics-favorites"));
    expect(screen.getByText("metrics.noMatches")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "metrics.clearSearch" }));
    expect(search).toHaveFocus();
    expect(current).toBeVisible();
    expect(current).toHaveAttribute("open");
    expect(screen.getByRole("region", { name: "metrics.favorites" })).toBeVisible();
  });

  it("restores favorites across report mounts and keeps keys absent from the current report", () => {
    localStorage.setItem("allure.metrics.favorites", JSON.stringify({ keys: ["bundle.size"], only: true }));
    const first = loadReport(["build.duration"]);
    expect(screen.getByText("metrics.noFavorites")).toBeVisible();
    fireEvent.click(screen.getByTestId("metrics-favorites"));
    first.unmount();
    loadReport();
    const pinned = within(screen.getByRole("region", { name: "metrics.favorites" }));
    expect(pinned.getByRole("button", { name: "Installed footprint" })).toBeVisible();
    expect(screen.getByTestId("metrics-favorites")).toHaveAttribute("aria-pressed", "false");
  });

  it("changes one favorite without overwriting storage edits made after the report opened", () => {
    const storageKey = "allure.metrics.favorites";
    loadReport();
    localStorage.setItem(storageKey, JSON.stringify({ keys: ["another.report"], only: false }));

    const summary = within(screen.getByRole("region", { name: "metrics.phaseSummary" }));
    const row = summary.getByRole("button", { name: "Installed footprint" }).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "metrics.addFavorite" }));
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual({
      keys: ["another.report", "bundle.size"],
      only: false,
    });
  });

  it("retains focus on a star moved by an update from another tab", () => {
    loadReport();
    const summary = within(screen.getByRole("region", { name: "metrics.phaseSummary" }));
    const row = summary.getByRole("button", { name: "Installed footprint" }).closest("tr")!;
    within(row).getByRole("button", { name: "metrics.addFavorite" }).focus();

    const key = "allure.metrics.favorites";
    localStorage.setItem(key, JSON.stringify({ keys: ["bundle.size"], only: false }));
    fireEvent(window, new StorageEvent("storage", { key }));

    const pinned = within(summary.getByRole("region", { name: "metrics.favorites" }));
    expect(pinned.getByRole("button", { name: "metrics.removeFavorite" })).toHaveFocus();
  });

  it("compares the current mean for repeated measurements while displaying each individual value", async () => {
    metricsStore.value = {
      loading: false,
      data: {
        current: [
          { id: "a", key: "size", value: 2048, unit: "bytes", start: 0, stop: 1 },
          { id: "b", key: "size", value: 4096, unit: "bytes", start: 1, stop: 2 },
        ],
        history: [{ uuid: "before", name: "Before", timestamp: 1, metrics: { size: 1024 } }],
      },
    };
    render(<ReportMetrics />);
    fireEvent.click(screen.getByRole("button", { name: "metrics.timelineView" }));
    const timeline = await screen.findByTestId("metrics-timeline");
    const bars = within(timeline).getAllByTestId("metric-interval");
    expect(bars[0]).toHaveTextContent("2 KiB (Δ metrics.table.avg +2 KiB)");
    expect(bars[1]).toHaveTextContent("4 KiB (Δ metrics.table.avg +2 KiB)");
  });

  it("labels chart bars with metric values and signed history deltas rather than interval durations", async () => {
    showMetrics(2048, "bytes", [{ uuid: "before", name: "Before", timestamp: 1, metrics: { size: 1024 } }]);
    fireEvent.click(screen.getByRole("button", { name: "metrics.timelineView" }));
    const timeline = await screen.findByTestId("metrics-timeline");
    expect(within(timeline).getByTestId("metric-interval")).toHaveTextContent("2 KiB (+1 KiB)");
  });

  it("shows an empty timeline without a root or zoom controls when no measurements exist", async () => {
    metricsStore.value = { loading: false, data: { current: [], history: [] } };
    render(<ReportMetrics />);
    fireEvent.click(screen.getByRole("button", { name: "metrics.timelineView" }));
    expect(await screen.findByText("metrics.noIntervals")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "metrics.resetZoom" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("metric-interval")).not.toBeInTheDocument();
  });

  it("explains an empty timeline when recorded intervals are invalid", async () => {
    metricsStore.value = {
      loading: false,
      data: { current: [{ id: "invalid", key: "invalid", value: 1, start: 2, stop: 1 }], history: [] },
    };
    render(<ReportMetrics />);
    fireEvent.click(screen.getByRole("button", { name: "metrics.timelineView" }));
    expect(await screen.findByText("metrics.noIntervals")).toBeInTheDocument();
    expect(screen.getByText("metrics.invalidIntervals")).toBeInTheDocument();
    expect(screen.queryByTestId("metric-interval")).not.toBeInTheDocument();
  });

  it("opens the timeline on demand and preserves scope selection and expanded table history across tabs", async () => {
    metricsStore.value = {
      loading: false,
      data: {
        current: [
          { id: "run", key: "run", title: "Run", value: 100, start: 0, stop: 100, better: "lower" },
          { id: "child", key: "child", title: "Child", value: 80, start: 20, stop: 100, better: "lower" },
          { id: "other", key: "other", title: "Other root", value: 1, start: 0, stop: 1 },
        ],
        history: [{ uuid: "before", name: "Before", timestamp: 1, metrics: { run: 120, child: 100 } }],
        hierarchy: [
          { key: "run", children: [{ key: "missing", children: [{ key: "child", children: [] }] }] },
          { key: "other", children: [] },
        ],
      },
    };
    render(<ReportMetrics />);
    expect(screen.queryByTestId("metrics-timeline")).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("region", { name: "metrics.phaseSummary" })).getByRole("button", { name: "Run" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "metrics.timelineView" }));
    const timeline = await screen.findByTestId("metrics-timeline");
    fireEvent.click(within(timeline).getByRole("button", { name: "Other root" }));
    fireEvent.click(screen.getByRole("button", { name: "Run run", exact: true }));
    expect(within(timeline).queryByText("metrics.noMeasurement")).not.toBeInTheDocument();
    expect(within(timeline).getAllByTestId("metric-interval")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "metrics.tableView" }));
    expect(screen.getByRole("region", { name: "metrics.historyTitle Run" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "metrics.timelineView" }));
    expect(
      within(await screen.findByTestId("metrics-timeline")).getByRole("button", { name: "Run", exact: true }),
    ).toBeInTheDocument();
  });

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

    fireEvent.click(within(summary).getByRole("button", { name: "Attachment size" }));
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
    [999.99, "ms", "999.99 ms"],
    [1000, "ms", "1 s"],
    [1234.567, "ms", "1.23 s"],
    [28888.704, "ms", "28.89 s"],
    [-14998.925, "ms", "-15 s"],
    [0.001, "ms", "0.001 ms"],
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
