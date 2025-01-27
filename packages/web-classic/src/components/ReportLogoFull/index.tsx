import { SvgIcon, allureIcons } from "@allurereport/web-components";
import { Text } from "@allurereport/web-components";
import { clsx } from "clsx";
import * as styles from "./styles.scss";

export const ReportLogoFull = (props: {
  /**
   * Additional class name
   */
  className?: string;
}) => {
  const { className } = props;

  return (
    <Text type="paragraph" size="m" bold className={clsx(className, styles.text)}>
      <SvgIcon id={allureIcons.reportLogo} size="m" inline className={styles.logo} />
      <span>Allure Report</span>
    </Text>
  );
};
