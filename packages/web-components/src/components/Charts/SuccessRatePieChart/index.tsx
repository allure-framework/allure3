import type { PieChartValues, PieSlice } from "@allurereport/charts-api";
import { emptyStatistic, getSuccessRateTotal, incrementStatistic } from "@allurereport/core-api";
import cx from "clsx";

import { Heading } from "@/components/Typography";

import { useChartTooltip } from "../ChartTooltip/useChartTooltip";
import { getColorFromStatus } from "../utils";
import {
  defaultSuccessRateI18n,
  formatChartPercentage,
  successRateDescription,
  type SuccessRateI18n,
} from "./successRate";

import styles from "./styles.scss";

export type { SuccessRateI18n } from "./successRate";

type SuccessRatePieChartProps = PieChartValues & {
  className?: string;
  i18n?: SuccessRateI18n;
};

const Slice = ({ slice, total, i18n }: { slice: PieSlice; total: number; i18n: SuccessRateI18n }) => {
  const text = i18n("statusSlice", {
    count: slice.count,
    status: i18n(`status.${slice.status}`),
    percent: formatChartPercentage(total ? (slice.count / total) * 100 : 0),
  });
  const { triggerProps, tooltip } = useChartTooltip(text);

  if (!slice.d) {
    return null;
  }

  if (slice.status === "__empty__") {
    return <path d={slice.d} fill="var(--color-control-bg)" />;
  }

  return (
    <>
      <path
        {...triggerProps}
        role="img"
        aria-label={text}
        className={styles.target}
        d={slice.d}
        fill={getColorFromStatus(slice.status, "chartFill")}
      />
      {tooltip}
    </>
  );
};

export const SuccessRatePieChart = ({
  slices,
  percentage,
  className,
  i18n = defaultSuccessRateI18n,
}: SuccessRatePieChartProps) => {
  const statistic = emptyStatistic();

  for (const slice of slices) {
    if (slice.status !== "__empty__") {
      incrementStatistic(statistic, slice.status, slice.count);
    }
  }

  const rate = statistic.total === 0 ? "???" : `${formatChartPercentage(percentage)}%`;
  const label = i18n("successRate", { rate });
  const description = successRateDescription(statistic.total, getSuccessRateTotal(statistic), i18n);
  const { triggerProps, tooltip } = useChartTooltip(`${label}\n${description}`, label);

  return (
    <article className={cx(styles.chart, className)}>
      <svg viewBox="0 0 100 100">
        <g transform="translate(50, 50)">
          {slices.map((slice) => (
            <Slice key={slice.status} slice={slice} total={statistic.total} i18n={i18n} />
          ))}
        </g>
      </svg>
      <div {...triggerProps} role="img" aria-label={label} className={cx(styles.legend, styles.target)}>
        <Heading size="s" tag="b">
          {rate}
        </Heading>
      </div>
      {tooltip}
    </article>
  );
};
