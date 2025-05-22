import type { FunctionalComponent } from "preact";
import styles from "./styles.scss";
import clsx from "clsx";
import { Text } from "@/components/Typography";

export type TagSkin = "successful" | "failed" | "warning" | "neutral";

export interface TagProps {
  className?: string;
  skin?: TagSkin;
}

export const Tag: FunctionalComponent<TagProps> = ({ className, skin, children }) => (
  <Text className={clsx(styles.tag, className, skin && styles[skin])} bold size="s" type="ui">
    {children}
  </Text>
);
