import { chartRenderers } from "@allurereport/web-commons";
import type { ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";

import { Button } from "../Button";
import { EmptyView } from "../EmptyView";
import { Spinner } from "../Spinner";
import type { ChartWidgetProps } from "./ChartWidget.types";

export type { ChartWidgetProps } from "./ChartWidget.types";

const rendererLoaders = {
  "pie": () => import(/* webpackChunkName: "chart-pie" */ "./PieChartRenderer"),
  "bar": () => import(/* webpackChunkName: "chart-bar" */ "./BarChartRenderer"),
  "treemap": () => import(/* webpackChunkName: "chart-treemap" */ "./TreeMapChartRenderer"),
  "heatmap": () => import(/* webpackChunkName: "chart-heatmap" */ "./HeatMapChartRenderer"),
  "funnel": () => import(/* webpackChunkName: "chart-funnel" */ "./FunnelChartRenderer"),
  "run-trend": () => import(/* webpackChunkName: "chart-run-trend" */ "./RunTrendChartRenderer"),
};
type Renderer = keyof typeof rendererLoaders;
const rendererCache = new Map<Renderer, ComponentType<ChartWidgetProps>>();
type LoadedRenderer = { renderer: Renderer; Component: ComponentType<ChartWidgetProps> };

export const ChartWidget = (props: ChartWidgetProps) => {
  const renderer = Object.prototype.hasOwnProperty.call(chartRenderers, props.chartData.type)
    ? chartRenderers[props.chartData.type]
    : undefined;
  const cached = renderer ? rendererCache.get(renderer) : undefined;
  const [loaded, setLoaded] = useState<LoadedRenderer | null>(
    renderer && cached ? { renderer, Component: cached } : null,
  );
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<Renderer | null>(null);

  useEffect(() => {
    if (!renderer) return;
    let mounted = true;
    setFailure(null);
    const cachedComponent = rendererCache.get(renderer);
    if (cachedComponent) {
      setLoaded({ renderer, Component: cachedComponent });
      return;
    }
    rendererLoaders[renderer]()
      .then(({ ChartRenderer }) => {
        rendererCache.set(renderer, ChartRenderer);
        if (mounted) setLoaded({ renderer, Component: ChartRenderer });
      })
      .catch(() => {
        if (mounted) setFailure(renderer);
      });
    return () => {
      mounted = false;
    };
  }, [renderer, attempt]);

  if (!renderer) return null;
  if (failure === renderer)
    return (
      <EmptyView description={props.t("loadError")} size="s">
        <Button
          style="flat"
          text={props.t("retry")}
          onClick={() => {
            setFailure(null);
            setAttempt((value) => value + 1);
          }}
        />
      </EmptyView>
    );
  if (!loaded || loaded.renderer !== renderer) return <Spinner />;
  const { Component } = loaded;
  return <Component {...props} />;
};
