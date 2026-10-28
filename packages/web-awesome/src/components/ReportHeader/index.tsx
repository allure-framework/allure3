import { formatDuration, type TestStatus } from "@allurereport/core-api";
import type { ExitCode, PluginGlobalError } from "@allurereport/plugin-api";
import { getReportOptions } from "@allurereport/web-commons";
import { Heading, Loadable, Text } from "@allurereport/web-components/core";
import type { ReportOptions } from "types";

import { GitInfo } from "@/components/ReportHeader/GitInfo";
import { ReportHeaderLogo } from "@/components/ReportHeader/ReportHeaderLogo";
import { ReportHeaderPie } from "@/components/ReportHeader/ReportHeaderPie";
import { TrStatus } from "@/components/TestResult/TrStatus";
import { useI18n } from "@/stores";
import { currentEnvironment } from "@/stores/env";
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

const resolveHeaderStatus = (
  errors: PluginGlobalError[] | undefined,
  exitCode: ExitCode | undefined,
): TestStatus | undefined => {
  if ((errors?.length ?? 0) > 0) {
    return "failed";
  }

  const code = exitCode?.actual ?? exitCode?.original;

  if (code === undefined) {
    return undefined;
  }

  return code === 0 ? "passed" : "failed";
};

export const ReportHeader = () => {
  const { reportName, createdAt, runSummary, runSummaryByEnv } = getReportOptions<ReportOptions>() ?? {};
  const { t } = useI18n("ui");
  const environmentId = currentEnvironment.value;
  // With a single environment selected, show that environment's own launch interval instead of the
  // report-wide one, which spans the earliest start and the latest stop across all environments.
  const selectedRunSummary = environmentId ? runSummaryByEnv?.[environmentId] : runSummary;
  const formattedCreatedAt = timestampToDate(createdAt as number, reportDateOptions);
  const formattedReportTime = selectedRunSummary
    ? `${timestampToDate(selectedRunSummary.start, reportDateOptions)} (${formatDuration(selectedRunSummary.duration)})`
    : formattedCreatedAt;

  return (
    <div className={styles["report-header"]}>
      <div className={styles["report-wrapper"]}>
        <ReportHeaderLogo />
        <Loadable
          source={globalsStore}
          renderData={({ exitCode, errors }) => {
            const code = exitCode?.actual ?? exitCode?.original;
            const headerStatus = resolveHeaderStatus(errors, exitCode);
            let reportDate = formattedReportTime;

            if (code !== undefined && exitCode?.actual !== undefined) {
              // Keep the existing i18n parameter name; the value can now be either a timestamp or run interval.
              reportDate = t("finishedAtBoth", {
                formattedCreatedAt: formattedReportTime,
                actual: exitCode.actual,
                original: exitCode.original,
              });
            } else if (code !== undefined && exitCode) {
              reportDate = t("finishedAtOriginal", {
                formattedCreatedAt: formattedReportTime,
                original: exitCode.original,
              });
            }

            return (
              <div className={styles["report-wrapper-text"]} data-testid="report-header">
                <div className={styles["report-header-title"]}>
                  {headerStatus !== undefined && <TrStatus status={headerStatus} />}
                  <Heading size={"s"} tag={"h2"} className={styles["wrapper-header"]} data-testid="report-title">
                    {reportName}
                  </Heading>
                </div>
                <Text type="paragraph" size="m" className={styles["report-date"]} data-testid="report-data">
                  {reportDate}
                </Text>
                <GitInfo />
              </div>
            );
          }}
        />
      </div>
      <ReportHeaderPie />
    </div>
  );
};
