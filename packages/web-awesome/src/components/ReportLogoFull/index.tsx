import { clsx } from "clsx";
import reportLogo from "@/assets/svg/report-logo.svg";
import { SvgIcon } from "../../commons/SvgIcon";
import { Text } from "../../commons/Typography";
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
