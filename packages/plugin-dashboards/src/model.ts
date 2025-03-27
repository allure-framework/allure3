
export type ChartType = "severity" | "status";

export type ChartMode = "raw" | "percent";

export type ChartOptions = {
  type: ChartType;
  mode?: ChartMode;
};

export type DashboardsOptions = {
  singleFile?: boolean;
  theme?: "light" | "dark";
  reportLanguage?: "en" | "ru";
  layout?: ChartOptions[];
};

export type DashboardsPluginOptions = DashboardsOptions;
