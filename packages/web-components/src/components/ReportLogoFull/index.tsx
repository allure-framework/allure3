import { clsx } from "clsx";

import { SvgIcon, allureIcons } from "../SvgIcon";
import { Text } from "../Typography";

import styles from "./styles.scss";

export const ReportLogoFull = (props: { className?: string }) => {
  const { className } = props;

  return (
    <Text type="paragraph" size="m" bold className={clsx(styles.text, className)}>
      <SvgIcon id={allureIcons.reportLogo} size="m" inline className={styles.logo} />
      <span>Allure Report</span>
    </Text>
  );
};
