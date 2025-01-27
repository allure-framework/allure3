import { Label } from "@allurereport/web-components";
import * as styles from "@/components/ReportHeader/styles.scss";

export const ReportHeaderLabelList = () => {
  return (
    <div className={styles["report-header-label-list"]}>
      {["Smoke", "regression", "nightly"].map((item, key) => {
        return <Label key={key}>{item}</Label>;
      })}
    </div>
  );
};
