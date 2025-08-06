import type { PieChartValues, TestStatus } from "@allurereport/core-api";
import cx from "clsx";
import { Heading } from "@/components/Typography";
import styles from "./styles.scss";

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

type SuccessRatePieChartProps = PieChartValues & {
  className?: string;
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
