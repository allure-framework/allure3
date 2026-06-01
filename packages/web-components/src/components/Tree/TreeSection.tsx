import clsx from "clsx";
import type { ComponentChildren, FunctionComponent } from "preact";

import { ArrowButton } from "@/components/ArrowButton";
import { SvgIcon } from "@/components/SvgIcon";
import { Text } from "@/components/Typography";

import styles from "./styles.scss";

interface TreeSectionProps {
  title: ComponentChildren;
  isOpened: boolean;
  toggleTree: () => void;
  icon?: string;
  focused?: boolean;
  nodeId?: string;
}

export const TreeSection: FunctionComponent<TreeSectionProps> = ({
  title,
  icon,
  isOpened,
  toggleTree,
  focused,
  nodeId,
  children,
  ...rest
}) => {
  return (
    <div
      data-testid="tree-section"
      {...rest}
      className={clsx(styles["tree-section"], focused ? styles["tree-section-focused"] : "")}
      onClick={toggleTree}
      id={nodeId}
      data-tree-node-id={nodeId}
    >
      <ArrowButton data-testid="tree-arrow" isOpened={isOpened} />
      {icon && <SvgIcon id={icon} size={"xs"} />}
      <Text data-testid="tree-section-title" size="m" bold className={styles["tree-section-title"]}>
        {title}
      </Text>
      {children}
    </div>
  );
};
