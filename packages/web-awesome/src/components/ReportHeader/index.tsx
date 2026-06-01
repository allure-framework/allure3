import { formatDuration } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { Heading, Loadable, Text, TooltipWrapper } from "@allurereport/web-components";
import type { AwesomeReportOptions } from "types";

import { ReportHeaderLogo } from "@/components/ReportHeader/ReportHeaderLogo";
import { ReportHeaderPie } from "@/components/ReportHeader/ReportHeaderPie";
import { TrStatus } from "@/components/TestResult/TrStatus";
import { useI18n } from "@/stores";
import { globalsStore } from "@/stores/globals";
import { timestampToDate } from "@/utils/time";

import * as styles from "./styles.scss";

const reportDateOptions: Intl.DateTimeFormatOptions = {
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
};

export const ReportHeader = () => {
  const { reportName, createdAt, runSummary } = getReportOptions<AwesomeReportOptions>() ?? {};
  const { t } = useI18n("ui");
  const formattedCreatedAt = timestampToDate(createdAt as number, reportDateOptions);
  const formattedReportTime = runSummary
    ? `${timestampToDate(runSummary.start, reportDateOptions)} (${formatDuration(runSummary.duration)})`
    : formattedCreatedAt;

  return (
    <div className={styles["report-header"]}>
      <div className={styles["report-wrapper"]}>
        <ReportHeaderLogo />
        <Loadable
          source={globalsStore}
          renderData={({ exitCode }) => {
            const code = exitCode?.actual ?? exitCode?.original;

            return (
              <div className={styles["report-wrapper-text"]} data-testid="report-header">
                <div className={styles["report-header-title"]}>
                  {code !== undefined && <TrStatus status={code === 0 ? "passed" : "failed"} />}
                  <Heading size={"s"} tag={"h2"} className={styles["wrapper-header"]} data-testid="report-title">
                    {reportName}
                  </Heading>
                </div>
                <Text type="paragraph" size="m" className={styles["report-date"]} data-testid="report-data">
                  {code === undefined
                    ? formattedReportTime
                    : exitCode.actual !== undefined
                      ? t("finishedAtBoth", {
                          // Keep the existing i18n parameter name; the value can now be either a timestamp or run interval.
                          formattedCreatedAt: formattedReportTime,
                          actual: exitCode.actual,
                          original: exitCode.original,
                        })
                      : t("finishedAtOriginal", {
                          // Keep the existing i18n parameter name; the value can now be either a timestamp or run interval.
                          formattedCreatedAt: formattedReportTime,
                          original: exitCode.original,
                        })}
                </Text>
              </div>
            );
          }}
        />
      </div>
      <ReportHeaderPie />
    </div>
  );
};
