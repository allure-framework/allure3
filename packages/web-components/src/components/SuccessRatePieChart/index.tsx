import { type Statistic, type TestStatus, statusesList } from "@allurereport/core-api";
import cx from "clsx";
import { type PieArcDatum, arc, pie } from "d3-shape";
import { Heading } from "@/components/Typography";
import styles from "./styles.scss";

type Slice = {
  status: TestStatus;
  count: number;
  d: string;
};

export type SuccessRatePieChartData = {
  percentage: number;
  slices: Slice[];
};

type SuccessRatePieChartProps = SuccessRatePieChartData & {
  className?: string;
};

const getColorFromStatus = (status: TestStatus) => {
  switch (status) {
    case "passed":
      return "var(--bg-support-castor)";
    case "failed":
      return "var(--bg-support-capella)";
    case "broken":
      return "var(--bg-support-atlas)";
    case "unknown":
      return "var(--bg-support-skat)";
    case "skipped":
      return "var(--bg-support-rau)";
    default:
      return "var(--bg-support-skat)";
  }
};

export const d3Arc = arc<PieArcDatum<Slice>>().innerRadius(40).outerRadius(50).cornerRadius(2).padAngle(0.03);

export const d3Pie = pie<Slice>()
  .value((d) => d.count)
  .padAngle(0.03)
  .sortValues((a, b) => a - b);

export const getPercentage = (value: number, total: number) => Math.floor((value / total) * 10000) / 100;

export const getChartData = (stats: Statistic): SuccessRatePieChartData => {
  const convertedStatuses = statusesList
    .filter((status) => !!stats?.[status])
    .map((status) => ({
      status,
      count: stats[status]!,
    }));
  const arcsData = d3Pie(convertedStatuses as Slice[]);
  const slices = arcsData.map((arcData) => ({
    // @ts-expect-error TS2783
    d: d3Arc(arcData),
    ...arcData.data,
  }));
  const percentage = getPercentage(stats.passed ?? 0, stats.total);

  return {
    slices,
    percentage,
  };
};

export const SuccessRatePieChart = ({ slices, percentage, className }: SuccessRatePieChartProps) => {
  return (
    <article aria-label="Success rate" role="presentation" className={cx(styles.chart, className)}>
      <svg aria-hidden viewBox="0 0 100 100">
        <g transform={"translate(50, 50)"}>
          {slices.map((slice) => (
            <path key={slice.status} d={slice.d} fill={getColorFromStatus(slice.status)} />
          ))}
        </g>
      </svg>
      {percentage !== undefined && (
        <Heading className={styles.legend} size="s" tag="b">
          {percentage}%
        </Heading>
      )}
    </article>
  );
};
