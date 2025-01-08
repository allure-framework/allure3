import type { TestStatus } from "@allurereport/core-api";
import { Heading } from "@/components/Typography";
import styles from "./styles.scss";

type Slice = {
  status: TestStatus;
  count: number;
  d: string;
};

type Props = {
  slices: Slice[];
  percentage: number;
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

export const SuccessRatePieChart = (props: Props) => {
  const { slices, percentage } = props;

  return (
    <article aria-label="Success rate" role="presentation" className={styles.chart}>
      <svg aria-hidden viewBox="0 0 100 100">
        <g transform={"translate(50, 50)"}>
          {slices.map((slice) => (
            <path key={slice.status} d={slice.d} fill={getColorFromStatus(slice.status)} />
          ))}
        </g>
      </svg>
      {!!percentage && (
        <Heading className={styles.legend} size="s" tag="b">
          {percentage}%
        </Heading>
      )}
    </article>
  );
};
