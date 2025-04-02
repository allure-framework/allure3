import { SvgIcon, allureIcons } from "@allurereport/web-components";
import { Text } from "@allurereport/web-components";
import { clsx } from "clsx";
import * as styles from "./styles.scss";
import type { FC } from "preact/compat";

export type ReportLogoFullProps = {
  className?: string;
};

export const ReportLogoFull: FC<ReportLogoFullProps> = ({ className }) => (
  <Text type="paragraph" size="m" bold className={clsx(className, styles.text)}>
    <SvgIcon id={allureIcons.reportLogo} size="m" inline className={styles.logo} />
    <span>Allure Report</span>
  </Text>
);
