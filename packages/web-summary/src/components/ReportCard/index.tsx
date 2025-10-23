import { type Statistic, type TestStatus, capitalize, formatDuration } from "@allurereport/core-api";
import { getPieChartValues } from "@allurereport/web-commons";
import { Heading, StatusLabel, SuccessRatePieChart, Text, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import IconLabel from "@/components/IconLabel";
import type { MetadataProps } from "@/components/MetadataRow/MetadataItem";
import MetadataItem, { MetadataTestType } from "@/components/MetadataRow/MetadataItem";
import { currentLocaleIso, useI18n } from "@/stores";
import * as styles from "./styles.scss";

export type ReportCardProps = {
  href: string;
  name: string;
  status: TestStatus;
  stats: Statistic;
  // TODO: use SummaryTestResult in the package
  newTests: any[];
  retryTests: any[];
  flakyTests: any[];
  duration: number;
  plugin?: string;
  createdAt?: number;
};

export const ReportCard: FunctionalComponent<ReportCardProps> = ({
  href,
  status,
  stats,
  name,
  duration,
  plugin,
  createdAt,
  newTests,
  flakyTests,
  retryTests,
}) => {
  const { t } = useI18n("summary");
  const { percentage, slices } = getPieChartValues(stats);
  const formattedDuration = formatDuration(duration);
  const formattedCreatedAt = new Date(createdAt as number).toLocaleDateString(currentLocaleIso.value as string, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  return (
    <a
      data-testid={"summary-report-card"}
      className={styles["report-card"]}
      href={href}
      target={"_blank"}
      rel="noreferrer"
    >
      <div>
        {plugin && (
          <Text type={"ui"} tag={"div"} size={"s"} className={styles["report-card-plugin"]}>
            {plugin}
          </Text>
        )}
        <div className={styles["report-card-title"]}>
          <Heading tag={"h2"} size={"s"}>
            {name}
          </Heading>
        </div>
        {formattedCreatedAt && (
          <Text tag={"div"} size={"s"} className={styles["report-card-created-at"]}>
            {formattedCreatedAt}
          </Text>
        )}
        <div className={styles["report-card-status"]}>
          <StatusLabel status={status}>{t(status)}</StatusLabel>
          <Text type={"ui"} size={"s"}>
            {t("in")}
          </Text>
          <Text type={"ui"} size={"s"} bold>
            {formattedDuration}
          </Text>
        </div>
        <div className={styles["report-card-metadata-icons"]}>
          <IconLabel tooltip={capitalize(t("new"))} icon={allureIcons.testNew}>
            {newTests?.length ?? 0}
          </IconLabel>
          <IconLabel tooltip={capitalize(t("flaky"))} icon={allureIcons.lineIconBomb2}>
            {flakyTests?.length ?? 0}
          </IconLabel>
          <IconLabel tooltip={capitalize(t("retry"))} icon={allureIcons.lineGeneralZap}>
            {retryTests?.length ?? 0}
          </IconLabel>
        </div>
        <div className={styles["report-card-metadata"]}>
          {[
            { label: "total", value: stats?.total },
            { label: "failed", value: stats?.failed },
            { label: "broken", value: stats?.broken },
            { label: "passed", value: stats?.passed },
            { label: "skipped", value: stats?.skipped },
            { label: "unknown", value: stats?.unknown },
          ]
            .filter((item) => item.value)
            .map(({ label, value }) => {
              const props = {
                title: capitalize(t(label)),
                count: value,
                status: label,
              } as MetadataProps;

              return (
                <MetadataItem
                  data-testid={`metadata-item-${label}`}
                  key={label}
                  props={props}
                  renderComponent={MetadataTestType}
                />
              );
            })}
        </div>
      </div>
      <div className={styles["report-card-chart-wrapper"]}>
        <SuccessRatePieChart className={styles["report-card-chart"]} slices={slices} percentage={percentage} />
      </div>
    </a>
  );
};
