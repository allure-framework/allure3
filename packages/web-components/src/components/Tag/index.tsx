import type { FunctionalComponent } from "preact";
import styles from "./styles.scss";
import clsx from "clsx";
import { Text } from "@/components/Typography";

export type TagKind = "successful" | "failed" | "warning" | "neutral";

export interface TagProps {
  className?: string;
  kind?: TagKind;
}

export const Tag: FunctionalComponent<TagProps> = ({ className, kind, children }) => (
  <Text className={clsx(styles.tag, className, kind && styles[kind])} bold size="s" type="ui">
    {children}
  </Text>
);
