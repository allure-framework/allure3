import type {
  BarChartType,
  BarGroup,
  BarGroupMode,
  BaseTrendSliceMetadata,
  ChartDataType,
  ChartId,
  ChartMode,
  ChartType,
  DurationsChartData,
  FunnelChartType,
  HeatMapSerie,
  StabilityDistributionChartData,
  StatusTransitionsChartData,
  TestBaseGrowthDynamicsChartData,
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

export interface ResponseBarChartData {
  type: ChartType.Bar;
  dataType: BarChartType;
  mode: ChartMode;
  title?: string;
  data: BarGroup<string, string>[];
  keys: readonly string[];
  indexBy: string;
  groupMode: BarGroupMode;
}

export interface ResponseComingSoonChartData {
  type: ChartType.ComingSoon;
  title?: string;
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
    | ResponseBarChartData
    | ResponseComingSoonChartData
    | ResponseTreeMapChartData
    | ResponseHeatMapChartData
  >;
  byEnv: {
    [env: string]: Record<
      ChartId,
      | ResponseTrendChartData<SeriesType, Metadata>
      | CurrentStatusChartData
      | ResponseBarChartData
      | ResponseComingSoonChartData
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
export interface UIBarChartData extends ResponseBarChartData {
  colors: Record<string, string>;
  xAxisConfig?: {
    legend?: string;
    enabled?: boolean;
    format?: string;
  };
  yAxisConfig?: {
    legend?: string;
    enabled?: boolean;
    format?: string;
    domain?: number[];
  };
  layout?: "horizontal" | "vertical";
  // Threshold value for the stability rate distribution chart
  threshold?: number;
}

export type UIComingSoonChartData = ResponseComingSoonChartData;

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
  | ResponseBarChartData
  | ResponseComingSoonChartData
  | ResponseTreeMapChartData
  | ResponseHeatMapChartData
  | TestBaseGrowthDynamicsChartData
  | ResponseTestingPyramidChartData;

export type UIChartData<Metadata extends BaseTrendSliceMetadata = BaseTrendSliceMetadata> =
  | UITrendChartData<Metadata>
  | UICurrentStatusChartData
  | UIStatusDynamicsChartData
  | UIBarChartData
  | UIComingSoonChartData
  | UITreeMapChartData
  | UIHeatMapChartData
  | UITestingPyramidChartData
  | UIStatusTransitionsChartData
  | UIDurationsChartData
  | TestBaseGrowthDynamicsChartData
  | StabilityDistributionChartData;

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
