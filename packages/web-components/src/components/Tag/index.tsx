import clsx from "clsx";
import type { FunctionComponent } from "preact";
import { Text } from "@/components/Typography";
import styles from "./styles.scss";

export type TagSkin = "successful" | "failed" | "warning" | "neutral";

export interface TagProps {
  "className"?: string;
  "skin"?: TagSkin;
  "data-testid"?: string;
}

export const Tag: FunctionComponent<TagProps> = ({ className, skin, children, "data-testid": dataTestId }) => (
  <Text className={clsx(styles.tag, className, skin && styles[skin])} bold size="s" type="ui" data-testid={dataTestId}>
    {children}
  </Text>
);
