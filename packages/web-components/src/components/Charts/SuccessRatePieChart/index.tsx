import type { PieChartValues, TestStatus } from "@allurereport/core-api";
import cx from "clsx";
import { Heading } from "@/components/Typography";
import { getColorFromStatus } from "../utils";
import styles from "./styles.scss";

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
