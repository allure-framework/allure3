import { SvgIcon } from "@allurereport/web-components";
import { clsx } from "clsx";
import type { FunctionalComponent } from "preact";
import AlertCircle from "@/assets/svg/solid-alert-circle.svg";
import CheckCircle from "@/assets/svg/solid-check-circle.svg";
import HelpCircle from "@/assets/svg/solid-help-circle.svg";
import MinusCircle from "@/assets/svg/solid-minus-circle.svg";
import XCircle from "@/assets/svg/solid-x-circle.svg";
import * as styles from "./styles.scss";

interface TestStatusIconProps {
  status?: "failed" | "broken" | "passed" | "skipped" | "unknown";
  className?: string;
  classNameIcon?: string;
}

const icons = {
  failed: XCircle.id,
  broken: AlertCircle.id,
  passed: CheckCircle.id,
  skipped: MinusCircle.id,
  unknown: HelpCircle.id,
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
