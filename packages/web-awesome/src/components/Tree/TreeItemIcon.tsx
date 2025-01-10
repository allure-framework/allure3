import { SvgIcon, allureIcons } from "@allurereport/web-components";
import { clsx } from "clsx";
import type { FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

interface TestStatusIconProps {
  status?: "failed" | "broken" | "passed" | "skipped" | "unknown";
  className?: string;
  classNameIcon?: string;
}

const { solidAlertCircle, solidCheckCircle, solidHelpCircle, solidMinusCircle, solidXCircle } = allureIcons;

const icons = {
  failed: solidXCircle,
  broken: solidAlertCircle,
  passed: solidCheckCircle,
  skipped: solidMinusCircle,
  unknown: solidHelpCircle,
};

const TreeItemIcon: FunctionalComponent<TestStatusIconProps> = ({ status = "unknown", className, classNameIcon }) => {
  const statusClass = clsx(styles[`status-${status}`], classNameIcon);

  return (
    <div data-testid={`tree-leaf-status-${status}`} className={clsx(styles["tree-item-icon"], className)}>
      <SvgIcon className={statusClass} id={icons[status]} />
    </div>
  );
};

export default TreeItemIcon;
