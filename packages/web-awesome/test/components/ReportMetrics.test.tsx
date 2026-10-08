import { cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    current: [{ id: "sample", key: "size", title: "Attachment size", value, unit, start: 1, stop: 2 }],
    history,
  };
  metricsStore.value = { loading: false, error: undefined, data };
  render(<ReportMetrics />);
  return data;
};

describe("components > ReportMetrics", () => {
  it("formats byte values and signed deltas throughout summary, history and current values", () => {
    const data = showMetrics(911140972, "bytes", [
      { uuid: "older", name: "Older", timestamp: 1, metrics: { size: 929439110 } },
      { uuid: "previous", name: "Previous", timestamp: 2, metrics: { size: 920766553 } },
    ]);
    const summary = within(screen.getByRole("region", { name: "metrics.phaseSummary" }))
      .getByRole("button", { name: "Attachment size" })
      .closest("tr")!;
    expect(within(summary).getAllByText("868.93 MiB")).toHaveLength(4);
    expect(within(summary).getByText("-9.18 MiB")).toBeInTheDocument();

    fireEvent.click(within(summary).getByRole("button"));
    const history = screen.getByRole("region", { name: "metrics.historyTitle Attachment size" });
    expect(within(history).getByText("868.93 MiB")).toBeInTheDocument();
    expect(within(history).getByText("886.38 MiB")).toBeInTheDocument();
    expect(within(history).getByText("878.11 MiB")).toBeInTheDocument();
    expect(within(history).getByText("-8.27 MiB")).toBeInTheDocument();

    fireEvent.click(screen.getByText("metrics.currentValues"));
    expect(screen.getAllByText("868.93 MiB")).toHaveLength(6);
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
});
