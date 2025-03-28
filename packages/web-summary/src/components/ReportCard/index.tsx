import { type Statistic, type TestStatus, formatDuration } from "@allurereport/core-api";
import { Heading, StatusLabel, SuccessRatePieChart, Text, getChartData } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { MetadataRow } from "@/components/MetadataRow";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

export type ReportCardProps = {
  href: string;
  name: string;
  status: TestStatus;
  stats: Statistic;
  duration: number;
};

export const ReportCard: FunctionalComponent<ReportCardProps> = ({ href, status, stats, name, duration }) => {
  const { t } = useI18n("summary");
  const { percentage, slices } = getChartData(stats);
  const formattedDuration = formatDuration(duration);

  return (
    <a className={styles["report-card"]} href={href}>
      <div className={styles["report-card-chart-wrapper"]}>
        <SuccessRatePieChart className={styles["report-card-chart"]} slices={slices} percentage={percentage} />
      </div>
      <div>
        <div className={styles["report-card-title"]}>
          <Heading tag={"h2"} size={"s"}>
            {name}
          </Heading>
        </div>
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
          <li>
            <MetadataRow label={t("passed")}>{stats?.passed ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={t("failed")}>{stats?.failed ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={t("broken")}>{stats?.broken ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={t("skipped")}>{stats?.skipped ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={t("unknown")}>{stats?.unknown ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={t("total")}>{stats?.total ?? 0}</MetadataRow>
          </li>
        </div>
      </div>
    </a>
  );
};
