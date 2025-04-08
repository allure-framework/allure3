import type { Statistic } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import type { PieArcDatum } from "d3-shape";
import { arc, pie } from "d3-shape";
import { type PieChartData, type PieSlice, type PieChartOptions } from "../model.js";

type BasePieSlice = Pick<PieSlice, "status" | "count">;

export const d3Arc = arc<PieArcDatum<BasePieSlice>>().innerRadius(40).outerRadius(50).cornerRadius(2).padAngle(0.03);

export const d3Pie = pie<BasePieSlice >()
  .value((d) => d.count)
  .padAngle(0.03)
  .sortValues((a, b) => a - b);

export const getPercentage = (value: number, total: number) => Math.floor((value / total) * 10000) / 100;

export const getPieChartData = (stats: Statistic, chartOptions: PieChartOptions): PieChartData => {
  const convertedStatuses = statusesList
    .filter((status) => !!stats?.[status])
    .map((status) => ({
      status,
      count: stats[status]!,
    }));
  const arcsData = d3Pie(convertedStatuses);
  const slices = arcsData.map((arcData) => ({
    d: d3Arc(arcData),
    ...arcData.data,
  }));
  const percentage = getPercentage(stats.passed ?? 0, stats.total);

  return {
    type: chartOptions.type,
    title: chartOptions?.title,
    slices,
    percentage,
  };
};
