import { SvgIcon, allureIcons } from "@/components/SvgIcon";
import styles from "./styles.scss";

const icons = {
  flaky: allureIcons.lineIconBomb2,
  new: allureIcons.lineGeneralEye,
};

const classNames = {
  flaky: styles["tree-item-meta-icon-flaky"],
  new: styles["tree-item-meta-icon-new"],
};

export interface TreeItemMetaIconProps {
  type: "flaky" | "new";
}

export const TreeItemMetaIcon = ({ type }: TreeItemMetaIconProps) => <SvgIcon id={icons[type]} className={classNames[type]} />;
