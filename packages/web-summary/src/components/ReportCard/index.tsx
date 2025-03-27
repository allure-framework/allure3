import { type Statistic, type TestStatus, formatDuration, statusesList } from "@allurereport/core-api";
import { Heading, StatusLabel, SuccessRatePieChart, Text } from "@allurereport/web-components";
import type { PieArcDatum } from "d3-shape";
import { arc, pie } from "d3-shape";
import type { FunctionalComponent } from "preact";
import { MetadataRow } from "@/components/MetadataRow";
import * as styles from "./styles.scss";

export type TestResultSlice = {
  status: TestStatus;
  count: number;
};

export type TestResultChartData = {
  percentage: number;
  slices: TestResultSlice[];
};

export const d3Arc = arc<PieArcDatum<TestResultSlice>>().innerRadius(40).outerRadius(50).cornerRadius(2).padAngle(0.03);

export const d3Pie = pie<TestResultSlice>()
  .value((d) => d.count)
  .padAngle(0.03)
  .sortValues((a, b) => a - b);

export const getPercentage = (value: number, total: number) => Math.floor((value / total) * 10000) / 100;

export const getChartData = (stats: Statistic): TestResultChartData => {
  const convertedStatuses = statusesList
    .filter((status) => !!stats?.[status])
    .map((status) => ({
      status,
      count: stats[status]!,
    }));
  const arcsData = d3Pie(convertedStatuses);
  const slices = arcsData.map((arcData) => ({
    d: d3Arc(arcData),
    ...arcData.data,
  }));
  const percentage = getPercentage(stats.passed ?? 0, stats.total);

  return {
    slices,
    percentage,
  };
};

export type ReportCardProps = {
  href: string;
  name: string;
  status: TestStatus;
  stats: Statistic;
  duration: number;
  environments?: string[];
};

export const ReportCard: FunctionalComponent<ReportCardProps> = ({
  href,
  status,
  stats,
  name,
  duration,
  environments = [],
}) => {
  const { percentage, slices } = getChartData(stats);
  const formattedDuration = formatDuration(duration);

  return (
    <a className={styles["report-card"]} href={href}>
      <div className={styles["report-card-chart-wrapper"]}>
        {/* @ts-ignore */}
        <SuccessRatePieChart className={styles["report-card-chart"]} slices={slices} percentage={percentage} />
      </div>
      <div>
        <div className={styles["report-card-title"]}>
          <Heading tag={"h2"} size={"s"}>
            {name}
          </Heading>
        </div>
        <div className={styles["report-card-status"]}>
          <StatusLabel status={status}>{status}</StatusLabel>
          <Text type={"ui"} size={"s"}>
            in
          </Text>
          <Text type={"ui"} size={"s"} bold>
            {formattedDuration}
          </Text>
        </div>
        <div className={styles["report-card-metadata"]}>
          {environments.length > 0 && (
            <li>
              <MetadataRow label={"Environments"}>{environments.join(", ")}</MetadataRow>
            </li>
          )}
          <li>
            <MetadataRow label={"Passed"}>{stats?.passed ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={"Failed"}>{stats?.failed ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={"Broken"}>{stats?.broken ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={"Skipped"}>{stats?.skipped ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={"Unknown"}>{stats?.unknown ?? 0}</MetadataRow>
          </li>
          <li>
            <MetadataRow label={"Total"}>{stats?.total ?? 0}</MetadataRow>
          </li>
        </div>
      </div>
    </a>
  );
};
