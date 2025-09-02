import { capitalize } from "@allurereport/core-api";
import { SvgIcon, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";
import { useI18n } from "@/stores";
import * as styles from "./styles.scss";

const icons: Record<string, string> = {
  flaky: allureIcons.lineIconBomb2,
  known: allureIcons.lineAlertsAlertCircle,
  muted: allureIcons.lineGeneralEye,
};

export const TestResultInfoStatuses: FunctionalComponent<{ statuses: [string, boolean][] }> = ({ statuses }) => {
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
