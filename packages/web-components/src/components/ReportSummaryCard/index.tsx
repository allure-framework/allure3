import { type Statistic, type TestStatus, capitalize, formatDuration } from "@allurereport/core-api";
import { getPieChartValues } from "@allurereport/web-commons";
import type { FunctionalComponent } from "preact";
import { SuccessRatePieChart } from "../Charts/SuccessRatePieChart";
import { IconLabel } from "../IconLabel";
import { StatusLabel } from "../StatusLabel";
import { allureIcons } from "../SvgIcon";
import { Heading, Text } from "../Typography";
import { MetadataItem, type MetadataProps, MetadataTestType } from "./components/MetadataItem";
import styles from "./styles.scss";

export type ReportSummaryCardProps = {
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
  localeIso?: string;
  locales?: {
    in?: string;
    new?: string;
    flaky?: string;
    retry?: string;
    total?: string;
    failed?: string;
    broken?: string;
    passed?: string;
    skipped?: string;
    unknown?: string;
  };
};

export const ReportSummaryCard: FunctionalComponent<ReportSummaryCardProps> = ({
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
  locales,
  localeIso = "en-US",
}) => {
  const { percentage, slices } = getPieChartValues(stats);
  const formattedDuration = formatDuration(duration);
  const formattedCreatedAt = new Date(createdAt as number).toLocaleDateString(localeIso as string, {
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
          <StatusLabel status={status}>{locales?.[status] ?? status}</StatusLabel>
          <Text type={"ui"} size={"s"}>
            {locales?.in ?? "in"}
          </Text>
          <Text type={"ui"} size={"s"} bold>
            {formattedDuration}
          </Text>
        </div>
        <div className={styles["report-card-metadata-icons"]}>
          <IconLabel tooltip={capitalize(locales?.new ?? "new")} icon={allureIcons.testNew}>
            {newTests?.length ?? 0}
          </IconLabel>
          <IconLabel tooltip={capitalize(locales?.flaky ?? "flaky")} icon={allureIcons.lineIconBomb2}>
            {flakyTests?.length ?? 0}
          </IconLabel>
          <IconLabel tooltip={capitalize(locales?.retry ?? "retry")} icon={allureIcons.lineGeneralZap}>
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
                title: capitalize(locales?.[label as keyof typeof locales] ?? label),
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
