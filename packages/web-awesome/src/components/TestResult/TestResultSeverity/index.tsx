import { SvgIcon } from "@allurereport/web-components";
import { Text } from "@allurereport/web-components";
import clsx from "clsx";
import i18n from "i18next";
import ChevronDownDouble from "@/assets/svg/line-arrows-chevron-down-double.svg";
import ChevronDown from "@/assets/svg/line-arrows-chevron-down.svg";
import ChevronUpDouble from "@/assets/svg/line-arrows-chevron-up-double.svg";
import ChevronUp from "@/assets/svg/line-arrows-chevron-up.svg";
import EqualIcon from "@/assets/svg/line-general-equal.svg";
import { useI18n } from "@/stores/locale";
import { capitalize } from "@/utils/capitalize";
import * as styles from "./styles.scss";

const icons = {
  blocker: ChevronUpDouble.id,
  critical: ChevronUp.id,
  normal: EqualIcon.id,
  minor: ChevronDown.id,
  trivial: ChevronDownDouble.id,
};

export const TestResultSeverity = ({ severity = "normal" }: { severity?: string }) => {
  const { t } = useI18n("severity");
  const statusClass = clsx(styles[`severity-${severity}`]);

  return (
    <div className={styles["test-result-severity"]}>
      <SvgIcon className={statusClass} id={icons[severity]} />
      <Text size={"s"} bold className={styles["test-result-severity-text"]}>
        {capitalize(t(severity))}
      </Text>
    </div>
  );
};
