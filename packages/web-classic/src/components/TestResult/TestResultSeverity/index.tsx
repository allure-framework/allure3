import { capitalize } from "@allurereport/core-api";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import clsx from "clsx";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

const icons: Record<string, string> = {
  blocker: allureIcons.lineArrowsChevronUpDouble,
  critical: allureIcons.lineArrowsChevronUp,
  normal: allureIcons.lineGeneralEqual,
  minor: allureIcons.lineArrowsChevronDown,
  trivial: allureIcons.lineArrowsChevronDownDouble,
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
