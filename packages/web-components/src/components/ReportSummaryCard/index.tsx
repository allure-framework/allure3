import type { Statistic, TestStatus } from "@allurereport/core-api";
import { formatDuration } from "@allurereport/core-api";
import { getPieChartValues } from "@allurereport/web-commons";
import { capitalize } from "lodash";
import { useMemo } from "preact/hooks";
import { SuccessRatePieChart } from "../Charts/SuccessRatePieChart";
import { IconLabel } from "../IconLabel";
import { StatusLabel } from "../StatusLabel";
import { allureIcons } from "../SvgIcon";
import { Code, Heading, Text } from "../Typography";
import { MetadataItem, MetadataTestType } from "./components/MetadataItem";
import type { I18nProp, ReportSummary } from "./model";
import styles from "./styles.scss";

export type ReportSummaryCardProps = {
  i18n: I18nProp;
  summary: ReportSummary;
};

const CreatedAt = (props: { createdAt?: number; i18n: I18nProp }) => {
  const { createdAt, i18n } = props;

  if (!createdAt) {
    return null;
  }

  const formattedCreatedAt =
    i18n("createdAt", { createdAt }) ??
    new Date(createdAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });

  return (
    <Text tag="time" size="s" className={styles.createdAt} dateTime={createdAt.toString()}>
      {formattedCreatedAt}
    </Text>
  );
};

const Pie = (props: { statistic: Statistic }) => {
  const { statistic } = props;
  const { percentage, slices } = getPieChartValues(statistic);
  return <SuccessRatePieChart className={styles.chart} slices={slices} percentage={Math.floor(percentage)} />;
};

const ReportStatus = (props: { status: TestStatus; duration: number; i18n: I18nProp }) => {
  const { status, duration, i18n } = props;
  const formattedDuration = formatDuration(duration);
  return (
    <p className={styles.reportStatus}>
      <StatusLabel status={status}>{i18n(`status.${status}`) ?? status}</StatusLabel>
      <span>
        <Text type="ui" size={"s"}>
          {i18n("in") ?? "in"}
        </Text>
        <span>&nbsp;</span>
        <Text type="ui" size="s" bold>
          {formattedDuration}
        </Text>
      </span>
    </p>
  );
};

const trimCount = (count: number) => {
  if (count > 999) {
    return "999+";
  }

  return count;
};

const Metadata = (props: { newCount?: number; flakyCount?: number; retryCount?: number; i18n: I18nProp }) => {
  const { flakyCount = 0, newCount = 0, retryCount = 0, i18n } = props;

  return (
    <div className={styles.metadata}>
      <IconLabel
        tooltip={i18n("metadata.new", { count: newCount }) ?? `${newCount} new tests`}
        icon={allureIcons.testNew}
      >
        {newCount === 0 ? "-" : trimCount(newCount)}
      </IconLabel>
      <IconLabel
        tooltip={i18n("metadata.flaky", { count: flakyCount }) ?? `${flakyCount} flaky tests`}
        icon={allureIcons.lineIconBomb2}
      >
        {flakyCount === 0 ? "-" : trimCount(flakyCount)}
      </IconLabel>
      <IconLabel
        tooltip={i18n("metadata.retry", { count: retryCount }) ?? `${retryCount} retry tests`}
        icon={allureIcons.lineGeneralZap}
      >
        {retryCount === 0 ? "-" : trimCount(retryCount)}
      </IconLabel>
    </div>
  );
};

const ReportStatistics = (props: { stats: Statistic; i18n: I18nProp }) => {
  const { stats, i18n } = props;

  const options = useMemo(() => {
    return (["failed", "broken", "passed", "skipped", "unknown"] as const)
      .map((item) => ({
        label: capitalize(i18n(`status.${item}`) ?? item),
        value: stats[item],
        status: item,
      }))
      .filter((item) => item.value && item.value > 0);
  }, [stats, i18n]);

  return (
    <div className={styles.statistics}>
      <MetadataItem
        props={{ count: stats.total, title: i18n("total") ?? "Total" }}
        renderComponent={MetadataTestType}
      />
      {options.map((item) => (
        <MetadataItem
          key={item.label}
          props={{ count: item.value, title: item.label, status: item.status }}
          renderComponent={MetadataTestType}
        />
      ))}
    </div>
  );
};

export const ReportSummaryCard = (props: ReportSummaryCardProps) => {
  const { summary, i18n } = props;
  const {
    href,
    remoteHref,
    status: generalStatus,
    stats,
    name,
    duration,
    createdAt,
    newTests,
    flakyTests,
    retryTests,
    plugin: pluginName,
  } = summary;

  const link = remoteHref || href;

  const isAnchor = typeof link === "string";

  const anchorProps = {
    href: link,
    target: "_blank",
    rel: "noreferrer",
  };

  const Tag = isAnchor ? "a" : "div";

  return (
    <Tag
      className={styles.wrapper}
      {...(isAnchor ? anchorProps : {})}
      onClick={
        isAnchor
          ? (event: MouseEvent) => {
              // Prevents the link from being followed
              // if the user is selecting text in the card
              if (window.getSelection()?.toString() !== "") {
                event.preventDefault();
              }
            }
          : undefined
      }
      data-testid="summary-report-card"
      draggable={false}
    >
      <div className={styles.row}>
        <div className={styles.content}>
          <div className={styles.header}>
            {pluginName && (
              <Code type="ui" tag="small" size="s" className={styles.pluginName}>
                {pluginName}
              </Code>
            )}
            <Heading tag="h2" size="s" className={styles.title}>
              {name}
            </Heading>
            <CreatedAt createdAt={createdAt} i18n={i18n} />
            <ReportStatus status={generalStatus} duration={duration} i18n={i18n} />
          </div>
          <Metadata
            newCount={newTests?.length}
            flakyCount={flakyTests?.length}
            retryCount={retryTests?.length}
            i18n={i18n}
          />
        </div>
        <div className={styles.pie}>
          <Pie statistic={stats} />
        </div>
      </div>
      <ReportStatistics stats={stats} i18n={i18n} />
    </Tag>
  );
};
