import lineAlertsAlertCircle from "@/assets/svg/line-alerts-alert-circle.svg";
import lineGeneralEye from "@/assets/svg/line-general-eye.svg";
import lineIconBomb2 from "@/assets/svg/line-icon-bomb-2.svg";
import { SvgIcon } from "@/components/commons/SvgIcon";
import { useI18n } from "@/stores";
import { capitalize } from "@/utils/capitalize";
import * as styles from "./styles.scss";

const icons = {
  flaky: lineIconBomb2.id,
  known: lineAlertsAlertCircle.id,
  muted: lineGeneralEye.id,
};

export const TestResultInfoStatuses = ({ statuses }) => {
  const { t } = useI18n("filters");
  return (
    <div className={styles["test-result-info-statuses"]}>
      {statuses.map(([status], key: number) => {
        const title = t(status);

        return (
          <div key={key} className={styles["test-result-info-status"]}>
            <SvgIcon className={styles["metadata-icon"]} id={icons[status]} size={"s"} />
            {capitalize(title)}
          </div>
        );
      })}
    </div>
  );
};
