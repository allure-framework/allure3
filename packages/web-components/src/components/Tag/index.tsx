import clsx from "clsx";
import type { FunctionComponent } from "preact";
import { Text } from "@/components/Typography";
import styles from "./styles.scss";

export type TagSkin = "successful" | "failed" | "warning" | "neutral";

export interface TagProps {
<<<<<<< HEAD
  "className"?: string;
  "skin"?: TagSkin;
  "data-testid"?: string;
}

export const Tag: FunctionComponent<TagProps> = ({ className, skin, children, "data-testid": testId }) => (
  <Text className={clsx(styles.tag, className, skin && styles[skin])} bold size="s" type="ui" data-testid={testId}>
=======
  className?: string;
  skin?: TagSkin;
}

export const Tag: FunctionalComponent<TagProps> = ({ className, skin, children }) => (
  <Text className={clsx(styles.tag, className, skin && styles[skin])} bold size="s" type="ui">
>>>>>>> 430d655ca (refactor/web-components: rename 'kind' prop to 'skin' in Tag component for improved clarity)
    {children}
  </Text>
);
