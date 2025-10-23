import type { BasePieSlice, PieChartValues } from "@allurereport/charts-api";
import type { Statistic } from "@allurereport/core-api";
import { statusesList } from "@allurereport/core-api";
import { arc, pie } from "d3-shape";
import type { PieArcDatum } from "d3-shape";

export const getPercentage = (value: number, total: number) => Math.floor((value / total) * 10000) / 100;

export const d3Arc = arc<PieArcDatum<BasePieSlice>>().innerRadius(40).outerRadius(50).cornerRadius(2).padAngle(0.03);

export const d3Pie = pie<BasePieSlice>()
  .value((d) => d.count)
  .padAngle(0.03)
  .sortValues((a, b) => a - b);

// TODO: Check the possibility to move it further to the plugin-consumers
export const getPieChartValues = (stats: Statistic): PieChartValues => {
  const convertedStatuses = statusesList
    .filter((status) => !!stats?.[status])
    .map((status) => ({
      status,
      count: stats[status]!,
    }));
  const arcsData = d3Pie(convertedStatuses);
  const slices = arcsData
    .map((arcData) => {
      const d = d3Arc(arcData);

      if (!d) {
        return null;
      }

      return {
        d,
        ...arcData.data,
      };
    })
    .filter((item) => item !== null);
  const percentage = getPercentage(stats.passed ?? 0, stats.total);

  return {
    slices,
    percentage,
  };
};
