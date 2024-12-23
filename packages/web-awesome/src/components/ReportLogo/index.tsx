import { getReportOptions } from "@allurereport/web-commons";
import { SvgIcon } from "@allurereport/web-components";
import { clsx } from "clsx";
import type { AllureAwesomeReportOptions } from "types";
import reportLogoDefault from "@/assets/svg/report-logo.svg";
import * as styles from "./styles.scss";

export const ReportLogo = (props: { className?: string; logo?: never }) => {
  const { className } = props;
  const { logo } = getReportOptions<AllureAwesomeReportOptions>() ?? {};

  return (
    <div className={clsx(styles["report-logo"], className)}>
      {logo ? <img src={logo} alt="report logo" /> : <SvgIcon id={reportLogoDefault.id} inline />}
    </div>
  );
};
