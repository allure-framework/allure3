import * as styles from "@/components/ReportHeader/styles.scss";
import { ReportLogo } from "@/components/ReportLogo";

export const ReportHeaderLogo = () => {
  return (
    <div className={styles["report-header-logo"]}>
      <ReportLogo />
    </div>
  );
};
