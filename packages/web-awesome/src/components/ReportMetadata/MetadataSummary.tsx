import { type Statistic, capitalize, statusesList } from "@allurereport/core-api";
import { computed } from "@preact/signals";
import type { FunctionalComponent } from "preact";
import MetadataItem, { type MetadataProps } from "@/components/ReportMetadata/MetadataItem";
import { MetadataTestType } from "@/components/ReportMetadata/MetadataTestType";
import { MetadataWithIcon } from "@/components/ReportMetadata/MetadataWithIcon";
import * as styles from "@/components/ReportMetadata/styles.scss";
import { useI18n } from "@/stores/locale";

export interface MetadataSummaryProps {
  stats: Statistic;
}

const metadataTestsTypes = ["flaky", "new", "retries"] as const as (keyof Statistic)[];

export const MetadataSummary: FunctionalComponent<MetadataSummaryProps> = ({ stats }) => {
  const { t } = useI18n("statuses");
  const { t: testSummary } = useI18n("testSummary");

  const allTest = computed(() => ({
    title: testSummary("total"),
    type: "all",
    count: stats.total,
  }));

  const metaDataTests = metadataTestsTypes
    .map((type) => {
      if (!stats[type]) {
        return;
      }

      const props = { title: testSummary(type), count: stats[type] || 0, type: type };

      return (
        <div key={type}>
          <MetadataItem data-testid={`metadata-item-${type}`} props={props} renderComponent={MetadataWithIcon} />
        </div>
      );
    })
    .filter(Boolean);

  const metadataStatuses = statusesList
    .map((status) => ({ status, value: stats[status] }))
    .filter(({ value }) => value)
    .map(({ status, value }) => {
      const title = capitalize(t(status) ?? status ?? "");
      const props = {
        title,
        count: value,
        status,
      } as MetadataProps;

      return (
        <MetadataItem
          data-testid={`metadata-item-${status}`}
          key={status}
          props={props}
          renderComponent={MetadataTestType}
        />
      );
    });

  return (
    <div class={styles["report-metadata-summary"]}>
      <div className={styles["report-metadata-all-tests"]}>
        <MetadataItem data-testid="metadata-item-total" props={allTest.value} renderComponent={MetadataWithIcon} />
        {Boolean(metaDataTests.length) && <div className={styles["report-metadata-separator"]} />}
        {metaDataTests}
      </div>
      <div className={styles["report-metadata-status"]}>{metadataStatuses}</div>
    </div>
  );
};
