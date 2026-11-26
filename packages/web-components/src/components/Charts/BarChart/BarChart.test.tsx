import type { BarDatum, BarSvgProps } from "@nivo/bar";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

// Supply dimensions in jsdom while using Nivo's real bar chart and custom layers.
vi.mock("@nivo/bar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nivo/bar")>();

  return {
    ...actual,
    ResponsiveBar: (props: Omit<BarSvgProps<BarDatum>, "width" | "height">) => (
      <actual.Bar {...props} width={600} height={275} />
    ),
  };
});

const themeColors = [
  "--color-bg-primary",
  "--color-border-default",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-control-bg-ghost-hover",
  "--color-intent-success-text",
  "--color-intent-danger-text",
  "--color-intent-warning-text",
];

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    addEventListener() {},
    removeEventListener() {},
  }));
  // SVG transitions resolve theme colors, which the report stylesheet usually supplies.
  for (const color of themeColors) {
    document.documentElement.style.setProperty(color, "rgb(80, 80, 80)");
  }
});

afterEach(() => {
  cleanup();
  for (const color of themeColors) {
    document.documentElement.style.removeProperty(color);
  }
  vi.unstubAllGlobals();
});

const lineFor = (key: string) => document.querySelector(`[data-trend-key="${key}"]`);
const numberAttr = (node: Element, attr: string) => Number(node.getAttribute(attr));

const coordsForPath = (path: Element) => {
  const coordinates =
    path
      .getAttribute("d")
      ?.match(/-?\d+(?:\.\d+)?/g)
      ?.map(Number) ?? [];

  // One fitted segment with two endpoints.
  expect(coordinates).toHaveLength(4);
  return coordinates;
};

describe("Bar chart trend rendering", () => {
  it("fits both diff series on the bar scale and includes the comparison at zero", async () => {
    const { StatusTransitionsChartWidget } = await import("../StatusTransitionsChartWidget/index.js");
    render(
      <StatusTransitionsChartWidget
        title="Status transitions"
        i18n={(key) => key}
        data={[
          { id: "first", timestamp: 1, prevItemTimestamp: 0, fixed: 6, regressed: 0, malfunctioned: 0 },
          { id: "second", timestamp: 2, prevItemTimestamp: 1, fixed: 0, regressed: 0, malfunctioned: 0 },
          { id: "third", timestamp: 3, prevItemTimestamp: 2, fixed: 0, regressed: 1, malfunctioned: 0 },
          { id: "current", timestamp: 4, prevItemTimestamp: 3, fixed: 3, regressed: 0, malfunctioned: 0 },
        ]}
      />,
    );

    await screen.findByTestId("trend-lines-layer");
    const diff = lineFor("diffTrend")!;
    const cumulative = lineFor("cumulativeTrend")!;
    const markers = [...diff.querySelectorAll("circle")];
    const bars = screen.getAllByTestId("hover-rect");
    const toCenter = (bar: HTMLElement) => numberAttr(bar, "x") + numberAttr(bar, "width") / 2;
    expect(markers).toHaveLength(bars.length);
    for (const [index, marker] of markers.entries()) {
      expect(numberAttr(marker, "cx")).toBeCloseTo(toCenter(bars[index]));
    }

    const zeroTick = [...diff.closest("svg")!.querySelectorAll("text")].find((tick) => tick.textContent === "0")!;
    const zeroY = Number(zeroTick.parentElement?.getAttribute("transform")?.match(/^translate\(0,([\d.]+)\)$/)?.[1]);
    expect(numberAttr(markers[1], "cy")).toBeCloseTo(zeroY);
    const pixelsPerTest = (zeroY - numberAttr(markers[0], "cy")) / 6;
    expect(pixelsPerTest).toBeGreaterThan(0);
    expect(numberAttr(markers[2], "cy")).toBeCloseTo(zeroY + pixelsPerTest);
    expect(numberAttr(markers[3], "cy")).toBeCloseTo(zeroY - 3 * pixelsPerTest);

    const diffLine = diff.querySelector("path")!;
    const cumulativeLine = cumulative.querySelector("path")!;
    expect(diffLine.getAttribute("stroke-dasharray")).toBe("4");
    expect(cumulativeLine.hasAttribute("stroke-dasharray")).toBe(false);
    expect(cumulative.querySelectorAll("circle")).toHaveLength(0);

    const assertFit = (path: Element, firstValue: number, lastValue: number) => {
      const [startX, startY, endX, endY] = coordsForPath(path);
      expect(startX).toBeCloseTo(toCenter(bars[0]));
      expect(endX).toBeCloseTo(toCenter(bars[3]));
      expect(startY).toBeCloseTo(zeroY - firstValue * pixelsPerTest);
      expect(endY).toBeCloseTo(zeroY - lastValue * pixelsPerTest);
    };

    assertFit(diffLine, 3.5, 0.5);
    assertFit(cumulativeLine, 1.375, 1.75);
  });

  it("keeps the duration speedup trend on its percentage scale", async () => {
    const { DurationDynamicsChartWidget } = await import("../DurationDynamicsChartWidget/index.js");
    render(
      <DurationDynamicsChartWidget
        title="Duration dynamics"
        i18n={(key) => key}
        data={[
          { id: "first", timestamp: 1, duration: 100, sequentialDuration: 100, speedup: 1 },
          { id: "second", timestamp: 2, duration: 100, sequentialDuration: 200, speedup: 2 },
          { id: "current", timestamp: 3, duration: 100, sequentialDuration: 400, speedup: 4 },
        ]}
      />,
    );

    await screen.findByTestId("trend-lines-layer");
    const height = numberAttr(screen.getAllByTestId("hover-rect")[0], "height");
    const speedup = lineFor("speedup")!;
    const path = speedup.querySelector("path")!;
    const [, startY, , endY] = coordsForPath(path);

    expect(path.getAttribute("stroke-dasharray")).toBe("4");
    expect([...speedup.querySelectorAll("circle")].map((marker) => numberAttr(marker, "cy") / height)).toEqual([
      1, 0.5, 0.25,
    ]);
    expect(startY / height).toBeCloseTo(23 / 24);
    expect(endY / height).toBeCloseTo(5 / 24);
  });
});
