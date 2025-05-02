import { type Statistic, type TestStatus, formatDuration } from "@allurereport/core-api";
import { Heading, StatusLabel, SuccessRatePieChart, Text, getChartData } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { MetadataRow } from "@/components/MetadataRow";
import { currentLocaleIso, useI18n } from "@/stores";
import * as styles from "./styles.scss";

export type ReportCardProps = {
  href: string;
  name: string;
  status: TestStatus;
  stats: Statistic;
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
}) => {
  const { t } = useI18n("summary");
  const { percentage, slices } = getChartData(stats);
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
      <div className={styles["report-card-content"]}>
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
          <Text tag={"div"} size={"m"} className={styles["report-card-created-at"]}>
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
        <div className={styles["report-card-metadata"]}>
          {[
            { label: "total", value: stats?.total },
            { label: "failed", value: stats?.failed },
            { label: "broken", value: stats?.broken },
            { label: "passed", value: stats?.passed },
            { label: "skipped", value: stats?.skipped },
            { label: "unknown", value: stats?.unknown },
          ].map(({ label, value }) => (
            <MetadataRow key={label} status={label} label={t(label)}>
              {value ?? 0}
            </MetadataRow>
          ))}
        </div>
      </div>
      <div className={styles["report-card-chart-wrapper"]}>
        <SuccessRatePieChart className={styles["report-card-chart"]} slices={slices} percentage={percentage} />
      </div>
    </a>
  );
};
