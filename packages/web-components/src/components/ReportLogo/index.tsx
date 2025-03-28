import { clsx } from "clsx";
import { SvgIcon, allureIcons } from "../../";
import * as styles from "./styles.scss";

export const ReportLogo = (props: { className?: string; logo?: string }) => {
  const { className, logo } = props;

  return (
    <div className={clsx(styles["report-logo"], className)}>
      {logo ? <img src={logo} alt="report logo" /> : <SvgIcon id={allureIcons.reportLogo} inline />}
    </div>
  );
};
