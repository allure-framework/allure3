import type { BasePieSlice, PieChartValues } from "@allurereport/charts-api";
import type { Statistic } from "@allurereport/core-api";
import { getSuccessRate, statusesList } from "@allurereport/core-api";
import type { PieArcDatum } from "d3-shape";
import { arc, pie } from "d3-shape";

const createD3ArcGenerator = () =>
  arc<PieArcDatum<BasePieSlice>>().innerRadius(40).outerRadius(50).cornerRadius(2).padAngle(0.03);

const d3Pie = pie<BasePieSlice>()
  .value((d) => d.count)
  .padAngle(0.03)
  .sortValues((a, b) => a - b);

const d3Arc = createD3ArcGenerator();
const d3ArcFull = createD3ArcGenerator().padAngle(0).cornerRadius(0);

/** Share of passed tests among all tests, as Allure 2 computes it in the summary widget and the status pie. */
export const getPassedRate = (stats: Partial<Statistic>): number =>
  stats.total ? (stats.passed ?? 0) / stats.total : 0;

// TODO: Check the possibility to move it further to the plugin-consumers
export const getPieChartValues = (
  stats: Statistic,
  getRate: (stats: Statistic) => number = getSuccessRate,
): PieChartValues => {
  // Handle empty state - return a full circle with __empty__ status
  if (!stats?.total) {
    const emptySlice: BasePieSlice = { status: "__empty__", count: 1 };
    const emptyArcData: PieArcDatum<BasePieSlice> = {
      data: emptySlice,
      value: 1,
      index: 0,
      startAngle: 0,
      endAngle: Math.PI * 2,
      padAngle: 0,
    };
    const d = d3ArcFull(emptyArcData);

    return {
      slices: [{ d, ...emptySlice }],
      percentage: 0,
    };
  }

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
  // Nudge before flooring so float noise does not drop a hundredth: 29 / 100 * 10000 is 2899.9999999999995
  const percentage = Math.floor(getRate(stats) * 10000 + 1e-7) / 100;

  return {
    slices,
    percentage,
  };
};
