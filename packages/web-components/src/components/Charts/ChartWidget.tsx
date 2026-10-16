import { ChartType } from "@allurereport/charts-api";
import type { ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";

import { EmptyView } from "../EmptyView";
import { Spinner } from "../Spinner";
import type { ChartWidgetProps } from "./ChartWidget.types";

export type { ChartWidgetProps } from "./ChartWidget.types";

const chartAssetFamilies: Record<ChartType, Family> = {
  [ChartType.CurrentStatus]: "pie",
  [ChartType.StatusDynamics]: "bar",
  [ChartType.StatusTransitions]: "bar",
  [ChartType.Durations]: "bar",
  [ChartType.StabilityDistribution]: "bar",
  [ChartType.TestBaseGrowthDynamics]: "bar",
  [ChartType.StatusAgePyramid]: "bar",
  [ChartType.TrSeverities]: "bar",
  [ChartType.DurationDynamics]: "bar",
  [ChartType.CoverageDiff]: "treemap",
  [ChartType.SuccessRateDistribution]: "treemap",
  [ChartType.ProblemsDistribution]: "heatmap",
  [ChartType.TestingPyramid]: "funnel",
};

const familyLoaders = {
  pie: () => import(/* webpackChunkName: "chart-pie" */ "./families/pie"),
  bar: () => import(/* webpackChunkName: "chart-bar" */ "./families/bar"),
  treemap: () => import(/* webpackChunkName: "chart-treemap" */ "./families/treemap"),
  heatmap: () => import(/* webpackChunkName: "chart-heatmap" */ "./families/heatmap"),
  funnel: () => import(/* webpackChunkName: "chart-funnel" */ "./families/funnel"),
};
type Family = keyof typeof familyLoaders;
const familyCache = new Map<Family, ComponentType<ChartWidgetProps>>();
type LoadedFamily = { family: Family; Component: ComponentType<ChartWidgetProps> };

export const ChartWidget = (props: ChartWidgetProps) => {
  const family = Object.prototype.hasOwnProperty.call(chartAssetFamilies, props.chartData.type)
    ? chartAssetFamilies[props.chartData.type]
    : undefined;
  const cached = family ? familyCache.get(family) : undefined;
  const [loaded, setLoaded] = useState<LoadedFamily | null>(family && cached ? { family, Component: cached } : null);
  const [failure, setFailure] = useState<Family | null>(null);

  useEffect(() => {
    if (!family) return;
    let mounted = true;
    setFailure(null);
    const cachedComponent = familyCache.get(family);
    if (cachedComponent) {
      setLoaded({ family, Component: cachedComponent });
      return;
    }
    familyLoaders[family]()
      .then(({ ChartFamily }) => {
        familyCache.set(family, ChartFamily);
        if (mounted) setLoaded({ family, Component: ChartFamily });
      })
      .catch(() => {
        if (mounted) setFailure(family);
      });
    return () => {
      mounted = false;
    };
  }, [family]);

  if (!family) return null;
  if (failure === family) return <EmptyView description={props.t("loadError")} size="s" />;
  if (!loaded || loaded.family !== family) return <Spinner />;
  const { Component } = loaded;
  return <Component {...props} />;
};
