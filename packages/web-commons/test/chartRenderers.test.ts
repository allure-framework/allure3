import { ChartType } from "@allurereport/charts-api";
import { expect, it } from "vite-plus/test";

import { chartRenderers, collectChartAssetFeatures } from "../src/charts/renderers.js";

it("covers every chart type and conservatively preserves unknown configurations", () => {
  expect(Object.keys(chartRenderers).sort()).toEqual(Object.values(ChartType).sort());
  expect(new Set(collectChartAssetFeatures(Object.values(ChartType).map((type) => ({ type }))))).toEqual(
    new Set(["chart-pie", "chart-bar", "chart-treemap", "chart-heatmap", "chart-funnel"]),
  );
  expect(collectChartAssetFeatures([])).toEqual([]);
  expect(collectChartAssetFeatures([{ type: "constructor" }])).toBeUndefined();
  expect(collectChartAssetFeatures([{ type: "future-chart" }])).toBeUndefined();
});
