import { getReportOptions } from "@allurereport/web-commons";
import { Heading, Text } from "@allurereport/web-components";
import type { AwesomeReportOptions } from "types";
import { ReportHeaderLogo } from "@/components/ReportHeader/ReportHeaderLogo";
import { ReportHeaderPie } from "@/components/ReportHeader/ReportHeaderPie";
import { currentLocaleIso } from "@/stores";
import * as styles from "./styles.scss";

export const ReportHeader = () => {
  const { reportName, createdAt } = getReportOptions<AwesomeReportOptions>() ?? {};
  const formattedCreatedAt = new Date(createdAt as number).toLocaleDateString(currentLocaleIso.value as string, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className={styles["report-header"]}>
      <div className={styles["report-wrapper"]}>
        <ReportHeaderLogo />
        <div className={styles["report-wrapper-text"]}>
          <Heading size={"s"} tag={"h2"} className={styles["wrapper-header"]} data-testid="report-title">
            {reportName}
          </Heading>
          <Text type="paragraph" size="m" className={styles["report-date"]}>
            {formattedCreatedAt}
          </Text>
        </div>
      </div>
      <ReportHeaderPie />
    </div>
  );
};
