import type {
  ChartId,
  ChartType,
  DurationDynamicsChartData,
  DurationsChartData,
  HeatMapSerie,
  StabilityDistributionChartData,
  StatusAgePyramidChartData,
  StatusTransitionsChartData,
  TestBaseGrowthDynamicsChartData,
  TestingPyramidChartData,
  TrSeveritiesChartData,
  TreeMapNode,
} from "@allurereport/charts-api";
import type { Statistic, TestStatus } from "@allurereport/core-api";

export type TreeMapTooltipAccessor = <T>(node: T) => string[];

export interface Point {
  x: Date | string | number;
  y: number;
}

export interface TrendChartItem {
  id: string;
  data: Point[];
  color: string;
}

export interface CurrentStatusChartData {
  type: ChartType.CurrentStatus;
  title?: string;
  data: Statistic;
  statuses?: TestStatus[];
  metric?: TestStatus;
}

export interface StatusDynamicsChartData {
  type: ChartType.StatusDynamics;
  title?: string;
  data: {
    statistic: Statistic;
    id: string;
    timestamp: number;
    name: string;
  }[];
  limit?: number;
  statuses?: TestStatus[];
}

export interface ResponseTreeMapChartData {
  type: ChartType.CoverageDiff | ChartType.SuccessRateDistribution;
  title?: string;
  treeMap: TreeMapNode;
}

export interface ResponseHeatMapChartData {
  type: ChartType.ProblemsDistribution;
  title?: string;
  data: HeatMapSerie[];
}

export type ChartsResponse = {
  general: Record<ChartId, CurrentStatusChartData | ResponseTreeMapChartData | ResponseHeatMapChartData>;
  byEnv: {
    [env: string]: Record<ChartId, CurrentStatusChartData | ResponseTreeMapChartData | ResponseHeatMapChartData>;
  };
};

export type UICurrentStatusChartData = CurrentStatusChartData;
export type UIStatusDynamicsChartData = StatusDynamicsChartData;
export type UIStatusTransitionsChartData = StatusTransitionsChartData;
export type UIDurationsChartData = DurationsChartData;

export interface UITreeMapChartData extends ResponseTreeMapChartData {
  colors: (value: number, domain?: number[]) => string;
  formatLegend?: (value: number) => string;
  legendDomain?: number[];
  tooltipRows?: TreeMapTooltipAccessor;
}

export interface UIHeatMapChartData extends ResponseHeatMapChartData {
  colors: (value: number, domain?: number[]) => string;
}

export type ChartData =
  | CurrentStatusChartData
  | StatusDynamicsChartData
  | StatusTransitionsChartData
  | DurationsChartData
  | StabilityDistributionChartData
  | ResponseTreeMapChartData
  | ResponseHeatMapChartData
  | TestBaseGrowthDynamicsChartData
  | StatusAgePyramidChartData
  | TrSeveritiesChartData
  | DurationDynamicsChartData
  | TestingPyramidChartData;

export type UIChartData =
  | UICurrentStatusChartData
  | UIStatusDynamicsChartData
  | UITreeMapChartData
  | UIHeatMapChartData
  | UIStatusTransitionsChartData
  | UIDurationsChartData
  | TestBaseGrowthDynamicsChartData
  | StatusAgePyramidChartData
  | StabilityDistributionChartData
  | TrSeveritiesChartData
  | DurationDynamicsChartData
  | TestingPyramidChartData;

export type ChartsData = Record<ChartId, ChartData>;

export type ChartsDataWithEnvs = {
  general: Record<ChartId, ChartData>;
  byEnv: {
    [env: string]: Record<ChartId, ChartData>;
  };
};

export type UIChartsData = Record<ChartId, UIChartData>;

export type UIChartsDataWithEnvs = {
  general: UIChartsData;
  byEnv: {
    [env: string]: UIChartsData;
  };
};
