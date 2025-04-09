import { getReportOptions } from "@allurereport/web-commons";
import { SvgIcon, allureIcons } from "@allurereport/web-components";
import { clsx } from "clsx";
import type { DashboardReportOptions } from "types";
import * as styles from "./styles.scss";

export const ReportLogo = (props: { className?: string; logo?: never }) => {
  const { className } = props;
  const { logo } = getReportOptions<DashboardReportOptions>() ?? {};

  return (
    <div className={clsx(styles["report-logo"], className)}>
      {logo ? <img src={logo} alt="report logo" /> : <SvgIcon id={allureIcons.reportLogo} inline />}
    </div>
  );
};
