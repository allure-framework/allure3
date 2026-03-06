import { getReportOptions } from "@allurereport/web-commons";
import { ReportLogo } from "@allurereport/web-components";

import type { ClassicReportOptions } from "../../../types";

import * as styles from "@/components/ReportHeader/styles.scss";

export const ReportHeaderLogo = () => {
  const { logo } = getReportOptions<ClassicReportOptions>() ?? {};

  return (
    <div className={styles["report-header-logo"]}>
      <ReportLogo logo={logo} />
    </div>
  );
};
