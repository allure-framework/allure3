import { getReportOptions } from "@allurereport/web-commons";
import { Heading, Loadable, Text, TooltipWrapper } from "@allurereport/web-components";
import type { AwesomeReportOptions } from "types";
import { ReportHeaderLogo } from "@/components/ReportHeader/ReportHeaderLogo";
import { ReportHeaderPie } from "@/components/ReportHeader/ReportHeaderPie";
import { TrStatus } from "@/components/TestResult/TrStatus";
import { currentLocaleIso, useI18n } from "@/stores";
import { globalsStore } from "@/stores/globals";
import * as styles from "./styles.scss";

export const ReportHeader = () => {
  const { reportName, createdAt } = getReportOptions<AwesomeReportOptions>() ?? {};
  const { t } = useI18n("ui");
  const formattedCreatedAt = new Date(createdAt as number).toLocaleDateString(currentLocaleIso.value as string, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  return (
    <div className={styles["report-header"]}>
      <div className={styles["report-wrapper"]}>
        <ReportHeaderLogo />
        <div className={styles["report-wrapper-text"]}>
          <div className={styles["report-header-title"]}>
            <Loadable
              source={globalsStore}
              renderData={({ exitCode }) => {
                const status = exitCode === 0 ? "passed" : "failed";

                return (
                  <TooltipWrapper tooltipText={t("exitCodeTooltip", { exitCode })}>
                    <TrStatus status={status} />
                  </TooltipWrapper>
                );
              }}
            />
            <Heading size={"s"} tag={"h2"} className={styles["wrapper-header"]} data-testid="report-title">
              {reportName}
            </Heading>
          </div>
          <Text type="paragraph" size="m" className={styles["report-date"]}>
            {formattedCreatedAt}
          </Text>
        </div>
      </div>
      <ReportHeaderPie />
    </div>
  );
};
