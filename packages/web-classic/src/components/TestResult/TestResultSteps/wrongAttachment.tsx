import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";
import { useI18n } from "@/stores";

export const EmptyComponent = () => {
  const { t } = useI18n("errors");

  return <div className={styles["wrong-attachment-sign"]}>{t("missedAttachment")}</div>;
};
