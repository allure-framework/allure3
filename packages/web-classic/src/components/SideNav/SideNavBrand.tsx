import { getReportOptions } from "@allurereport/web-commons";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { h } from "preact";

import type { ReportOptions } from "../../../types";

import * as styles from "./styles.scss";

const DEFAULT_REPORT_NAME = "Allure Report";

export const SideNavBrand = () => {
  const { reportName, logo } = getReportOptions<ReportOptions>() ?? {};
  const name = reportName?.trim() || DEFAULT_REPORT_NAME;

  return (
    <a href="#" className={styles.brand} title={name} data-ga4-event="home_click" data-testid="report-brand">
      {logo ? (
        <img src={logo} alt="" className={styles["brand-logo"]} data-testid="report-logo" />
      ) : (
        <SvgIcon id={allureIcons.reportLogo} size={"s"} className={styles.icon} />
      )}
      <Text className={styles["brand-text"]} bold data-testid="report-name">
        {name}
      </Text>
    </a>
  );
};
