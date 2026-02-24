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
}

export const TreeSection: FunctionComponent<TreeSectionProps> = ({
  title,
  icon,
  isOpened,
  toggleTree,
  children,
  ...rest
}) => {
  return (
    <div data-testid="tree-section" {...rest} className={styles["tree-section"]} onClick={toggleTree}>
      <ArrowButton data-testid="tree-arrow" isOpened={isOpened} />
      {icon && <SvgIcon id={icon} size={"xs"} />}
      <Text data-testid="tree-section-title" size="m" bold className={styles["tree-section-title"]}>
        {title}
      </Text>
      {children}
    </div>
  );
};
