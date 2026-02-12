import type { PieChartValues } from "@allurereport/charts-api";
import cx from "clsx";
import { Heading } from "@/components/Typography";
import { getColorFromStatus } from "../utils";
import styles from "./styles.scss";

type SuccessRatePieChartProps = PieChartValues & {
  className?: string;
};

const isValidPercentage = (percentage: number) =>
  typeof percentage === "number" && percentage >= 0 && percentage <= 100;

export const SuccessRatePieChart = ({ slices, percentage, className }: SuccessRatePieChartProps) => {
  return (
    <article aria-label="Success rate" role="presentation" className={cx(styles.chart, className)}>
      <svg aria-hidden viewBox="0 0 100 100">
        <g transform={"translate(50, 50)"}>
          {slices.map(
            (slice) =>
              !!slice.d && (
                <path
                  key={slice.status}
                  d={slice.d}
                  fill={slice.status === "__empty__" ? "var(--bg-control-secondary)" : getColorFromStatus(slice.status)}
                />
              ),
          )}
        </g>
      </svg>
      {isValidPercentage(percentage) && (
        <Heading className={styles.legend} size="s" tag="b">
          {percentage === 0 ? "0" : `${percentage}%`}
        </Heading>
      )}
    </article>
  );
};
