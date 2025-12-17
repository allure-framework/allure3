import type {
  BaseTrendSliceMetadata,
  ChartDataType,
  ChartId,
  ChartMode,
  ChartType,
  DurationsChartData,
  FBSUAgePyramidChartData,
  FunnelChartType,
  HeatMapSerie,
  StabilityDistributionChartData,
  StatusTransitionsChartData,
  TestBaseGrowthDynamicsChartData,
  TrSeveritiesChartData,
  TreeMapChartType,
  TreeMapNode,
  TrendPointId,
  TrendSlice,
  TrendSliceId,
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

export interface ResponseTrendChartData<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  title?: string;
  min: number;
  max: number;
  points: Record<TrendPointId, Point>;
  slices: Record<TrendSliceId, TrendSlice<Metadata>>;
  series: Record<SeriesType, TrendPointId[]>;
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
  type: ChartType.TreeMap;
  dataType: TreeMapChartType;
  title?: string;
  treeMap: TreeMapNode;
}

export interface ResponseHeatMapChartData {
  type: ChartType.HeatMap;
  title?: string;
  data: HeatMapSerie[];
}

export type ChartsResponse<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> = {
  general: Record<
    ChartId,
    | ResponseTrendChartData<SeriesType, Metadata>
    | CurrentStatusChartData
    | ResponseTreeMapChartData
    | ResponseHeatMapChartData
  >;
  byEnv: {
    [env: string]: Record<
      ChartId,
      | ResponseTrendChartData<SeriesType, Metadata>
      | CurrentStatusChartData
      | ResponseTreeMapChartData
      | ResponseHeatMapChartData
    >;
  };
};

export interface UITrendChartData<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> {
  type: ChartType.Trend;
  dataType: ChartDataType;
  mode: ChartMode;
  min: number;
  max: number;
  items: TrendChartItem[];
  slices: TrendSlice<Metadata>[];
  title?: string;
}

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

export interface UITestingPyramidChartData extends ResponseTestingPyramidChartData {}

export interface ResponseTestingPyramidChartData {
  type: ChartType.Funnel;
  dataType: FunnelChartType;
  title?: string;
  data: {
    layer: string;
    testCount: number;
    successRate: number;
    percentage: number;
  }[];
}

export type ChartData<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> =
  | ResponseTrendChartData<SeriesType, Metadata>
  | CurrentStatusChartData
  | StatusDynamicsChartData
  | StatusTransitionsChartData
  | DurationsChartData
  | StabilityDistributionChartData
  | ResponseTreeMapChartData
  | ResponseHeatMapChartData
  | TestBaseGrowthDynamicsChartData
  | FBSUAgePyramidChartData
  | ResponseTestingPyramidChartData
  | TrSeveritiesChartData;

export type UIChartData<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> =
  | UITrendChartData<Metadata>
  | UICurrentStatusChartData
  | UIStatusDynamicsChartData
  | UITreeMapChartData
  | UIHeatMapChartData
  | UITestingPyramidChartData
  | UIStatusTransitionsChartData
  | UIDurationsChartData
  | TestBaseGrowthDynamicsChartData
  | FBSUAgePyramidChartData
  | StabilityDistributionChartData
  | TrSeveritiesChartData;

export type ChartsData<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> = Record<ChartId, ChartData<SeriesType, Metadata>>;

export type ChartsDataWithEnvs<
  SeriesType extends string = string,
  Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata,
> = {
  general: Record<ChartId, ChartData<SeriesType, Metadata>>;
  byEnv: {
    [env: string]: Record<ChartId, ChartData<SeriesType, Metadata>>;
  };
};

export type UIChartsData<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> = Record<
  ChartId,
  UIChartData<Metadata>
>;

export type UIChartsDataWithEnvs<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> = {
  general: UIChartsData<Metadata>;
  byEnv: {
    [env: string]: UIChartsData<Metadata>;
  };
};
