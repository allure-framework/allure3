import type { Statistic } from "@allurereport/core-api";

export type I18nProp = (key: string, props?: Record<string, unknown>) => string;

export type Props = {
  title?: string;
  i18n?: I18nProp;
  data: Pick<Statistic, "total" | "failed" | "passed" | "skipped" | "unknown" | "broken">;
  centerMetric:
    | {
        type: "total";
      }
    | {
        type: "percent";
        by: string;
      };
};

export type ChartDatum = {
  id: string;
  // We need to set value to 1 to make sure that the arc is visible
  value: number;
  color: string;
  label: string;
};

export type ChartData = ChartDatum[];
