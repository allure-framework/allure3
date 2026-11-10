import { clsx } from "clsx";
import { useId } from "preact/hooks";

import { Counter } from "@/components/Counter";
import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import { Heading, Text } from "@/components/Typography";

import styles from "./styles.scss";

export type ReportFailureSummaryItem = {
  /**
   * Number of failures of this kind, a nonzero count is highlighted as failed
   */
  count: number;
  /**
   * Already translated label of the item
   */
  label: string;
  /**
   * Test id of the item
   */
  testId?: string;
};

export type ReportFailureSummaryProps = {
  /**
   * Already translated title of the summary
   */
  title: string;
  items: ReportFailureSummaryItem[];
  className?: string;
};

/**
 * Alert with the reasons why the report is considered failed: unsuccessful tests, failed quality gates, global errors.
 * The caller decides whether the summary is shown at all
 */
export const ReportFailureSummary = ({ title, items, className }: ReportFailureSummaryProps) => {
  const titleId = useId();

  return (
    <section
      className={clsx(styles["report-failure-summary"], className)}
      role="alert"
      aria-labelledby={titleId}
      data-testid="report-failure-summary"
    >
      <SvgIcon id={allureIcons.solidAlertCircle} size="m" className={styles["report-failure-summary-icon"]} />
      <div className={styles["report-failure-summary-body"]}>
        <Heading id={titleId} tag="h3" size="s" className={styles["report-failure-summary-title"]}>
          {title}
        </Heading>
        <ul className={styles["report-failure-summary-items"]}>
          {items.map(({ count, label, testId }) => (
            <li key={testId ?? label} className={styles["report-failure-summary-item"]} data-testid={testId}>
              <Counter count={count} status={count > 0 ? "failed" : undefined} />
              <Text type="ui" size="s">
                {label}
              </Text>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
