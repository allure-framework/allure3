import { type Statistic, capitalize, statusesList } from "@allurereport/core-api";
import { Loadable } from "@allurereport/web-components";
import { computed } from "@preact/signals";
import type { FunctionComponent } from "preact";
import MetadataItem, { type MetadataProps } from "@/components/ReportMetadata/MetadataItem";
import { MetadataTestType } from "@/components/ReportMetadata/MetadataTestType";
import { MetadataWithIcon } from "@/components/ReportMetadata/MetadataWithIcon";
import * as styles from "@/components/ReportMetadata/styles.scss";
import { statsStore } from "@/stores";
import { useI18n } from "@/stores/locale";

export const MetadataSummary: FunctionComponent = () => {
  const { t } = useI18n("statuses");
  const { t: testSummary } = useI18n("testSummary");

  return (
    <Loadable
      source={statsStore}
      renderError={() => null}
      renderData={(stats) => {
        const allTest = computed(() => ({
          title: capitalize(t("total")),
          type: "all",
          count: stats.total,
        }));
        const metaDataTests = ["flaky", "retry"]
          .map((key) => {
            if (!stats[key as keyof Statistic]) {
              return;
            }
            const title = testSummary(key);
            const props = { title, count: stats[key as keyof Statistic] || 0, type: key };

            return (
              <div key={key}>
                <MetadataItem key={key} props={props} renderComponent={MetadataWithIcon} />
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
              <MetadataItem
                data-testid="metadata-item-total"
                props={allTest.value}
                renderComponent={MetadataWithIcon}
              />
              {Boolean(metaDataTests.length) && <div className={styles["report-metadata-separator"]} />}
              {metaDataTests}
            </div>
            <div className={styles["report-metadata-status"]}>{metadataStatuses}</div>
          </div>
        );
      }}
    />
  );
};
