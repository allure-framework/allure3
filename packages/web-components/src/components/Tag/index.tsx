import type { FunctionComponent } from "preact";
import styles from "./styles.scss";
import clsx from "clsx";
import { Text } from "@/components/Typography";

export type TagSkin = "successful" | "failed" | "warning" | "neutral";

export interface TagProps {
  className?: string;
  skin?: TagSkin;
  "data-testid"?: string;
}

export const Tag: FunctionComponent<TagProps> = ({ className, skin, children, "data-testid": testId }) => (
  <Text className={clsx(styles.tag, className, skin && styles[skin])} bold size="s" type="ui" data-testid={testId}>
    {children}
  </Text>
);
