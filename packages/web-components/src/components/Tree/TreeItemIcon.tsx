import type { TestStatus } from "@allurereport/core-api";
import { clsx } from "clsx";
import type { FunctionalComponent } from "preact";
import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import styles from "./styles.scss";
import type { TestStatus } from "@allurereport/core-api";

interface TestStatusIconProps {
  status?: TestStatus;
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

export const TreeItemIcon: FunctionalComponent<TestStatusIconProps> = ({
  status = "unknown",
  className,
  classNameIcon,
}) => {
  const statusClass = clsx(styles[`status-${status}`], classNameIcon);

  return (
    <div data-testid={`tree-leaf-status-${status}`} className={clsx(styles["tree-item-icon"], className)}>
      <SvgIcon className={statusClass} id={icons[status]} />
    </div>
  );
};
