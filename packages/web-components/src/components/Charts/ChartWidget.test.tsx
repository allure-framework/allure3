import { ChartType } from "@allurereport/charts-api";
import type { UIChartData } from "@allurereport/web-commons";
import { cleanup, render, waitFor } from "@testing-library/preact";
import { useEffect, useState } from "preact/hooks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ChartWidgetProps } from "./ChartWidget.types";

const pieData: UIChartData = { type: ChartType.CurrentStatus, title: "first", data: { total: 1, passed: 1 } };
const barData: UIChartData = { type: ChartType.StatusDynamics, data: [] };
const t = (key: string) => `en:${key}`;
const empty = (key: string) => key;
beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  cleanup();
  vi.doUnmock("./PieChartRenderer");
  vi.doUnmock("./BarChartRenderer");
});

describe("shared async chart widget", () => {
  it("loads only the selected renderer and reuses it for another widget", async () => {
    const pieFactory = vi.fn(() => ({
      ChartRenderer: ({ chartData }: ChartWidgetProps) => <div>{chartData.title}</div>,
    }));
    const barFactory = vi.fn(() => ({ ChartRenderer: () => <div>bar</div> }));
    vi.doMock("./PieChartRenderer", pieFactory);
    vi.doMock("./BarChartRenderer", barFactory);
    const { ChartWidget } = await import("./ChartWidget");
    const view = render(<ChartWidget chartData={pieData} t={t} empty={empty} />);
    await waitFor(() => expect(view.container.textContent).toBe("first"));
    render(<ChartWidget chartData={{ ...pieData, title: "second" }} t={t} empty={empty} />);
    await waitFor(() => expect(pieFactory).toHaveBeenCalledTimes(1));
    expect(barFactory).not.toHaveBeenCalled();
  });

  it("uses fresh data and translations without remounting a loaded renderer", async () => {
    const received = vi.fn();
    const mounted = vi.fn();
    const unmounted = vi.fn();
    vi.doMock("./PieChartRenderer", () => ({
      ChartRenderer: (props: ChartWidgetProps) => {
        received(props);
        const [identity] = useState(() => Symbol("chart instance"));
        useEffect(() => {
          mounted(identity);
          return () => unmounted(identity);
        }, [identity]);
        return <div>{props.t(props.chartData.title ?? "")}</div>;
      },
    }));
    const { ChartWidget } = await import("./ChartWidget");
    const view = render(<ChartWidget chartData={pieData} t={t} empty={empty} />);
    await waitFor(() => expect(view.container.textContent).toBe("en:first"));
    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));
    const next = { ...pieData, title: "second" };
    view.rerender(<ChartWidget chartData={next} t={(key) => `ru:${key}`} empty={empty} />);
    expect(view.container.textContent).toBe("ru:second");
    expect(received.mock.calls.at(-1)?.[0].chartData).toBe(next);
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
    view.unmount();
    expect(unmounted).toHaveBeenCalledTimes(1);
    expect(unmounted).toHaveBeenCalledWith(mounted.mock.calls[0][0]);
  });

  it("does not render a previous renderer when its delayed import finishes after a type change", async () => {
    let finishPie!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      finishPie = resolve;
    });
    const staleRender = vi.fn(() => <div>stale pie</div>);
    vi.doMock("./PieChartRenderer", () => pending);
    vi.doMock("./BarChartRenderer", () => ({ ChartRenderer: () => <div>bar ready</div> }));
    const { ChartWidget } = await import("./ChartWidget");
    const view = render(<ChartWidget chartData={pieData} t={t} empty={empty} />);
    view.rerender(<ChartWidget chartData={barData} t={t} empty={empty} />);
    await waitFor(() => expect(view.container.textContent).toBe("bar ready"));
    finishPie({ ChartRenderer: staleRender });
    await pending;
    expect(view.container.textContent).toBe("bar ready");
    expect(staleRender).not.toHaveBeenCalled();
  });

  it("surfaces import failure and can still load a different renderer", async () => {
    vi.doMock("./PieChartRenderer", () => {
      throw new Error("chunk unavailable");
    });
    vi.doMock("./BarChartRenderer", () => ({ ChartRenderer: () => <div>bar ready</div> }));
    const { ChartWidget } = await import("./ChartWidget");
    const view = render(<ChartWidget chartData={pieData} t={t} empty={empty} />);
    await waitFor(() => expect(view.container.textContent).toContain("en:loadError"));
    view.rerender(<ChartWidget chartData={barData} t={t} empty={empty} />);
    await waitFor(() => expect(view.container.textContent).toBe("bar ready"));
  });

  it.each(["future-chart", "constructor"])(
    "keeps unknown chart type %s empty without importing any renderer",
    async (type) => {
      const pieFactory = vi.fn(() => ({ ChartRenderer: () => <div>pie</div> }));
      vi.doMock("./PieChartRenderer", pieFactory);
      const { ChartWidget } = await import("./ChartWidget");
      const view = render(<ChartWidget chartData={{ type } as unknown as UIChartData} t={t} empty={empty} />);
      expect(view.container.textContent).toBe("");
      expect(pieFactory).not.toHaveBeenCalled();
    },
  );
});
