import type { FunctionalComponent } from "preact";
import styles from "./styles.scss";
import clsx from "clsx";
import { Text } from "@/components/Typography";

export interface TagProps {
  className?: string;
}

export const Tag: FunctionalComponent<TagProps> = ({ className, children }) => (
  <Text className={clsx(styles.tag, className)} bold size="s" type="ui">
    {children}
  </Text>
);
