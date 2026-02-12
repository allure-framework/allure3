import clsx from "clsx";
import type { ComponentChildren } from "preact";
import { Text } from "@/components/Typography";
import styles from "./styles.scss";

export type TagSkin =
  | "successful"
  | "failed"
  | "warning"
  | "neutral"
  | "successful-light"
  | "failed-light"
  | "warning-light"
  | "neutral-light"
  | "secondary";

export interface TagProps {
  "className"?: string;
  "skin"?: TagSkin;
  "data-testid"?: string;
  "children": ComponentChildren;
}

export const Tag = ({ className, skin, children, "data-testid": dataTestId }: TagProps) => (
  <Text className={clsx(styles.tag, className, skin && styles[skin])} bold size="s" type="ui" data-testid={dataTestId}>
    {children}
  </Text>
);
