import { SvgIcon } from "@allurereport/web-components";
import { Text } from "@allurereport/web-components";
import { clsx } from "clsx";
import reportLogo from "@/assets/svg/report-logo.svg";
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
      <SvgIcon id={reportLogo.id} size="m" inline className={styles.logo} />
      <span>Allure Report</span>
    </Text>
  );
};
