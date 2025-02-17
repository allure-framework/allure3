import type { ComponentChildren } from "preact";
import * as styles from "./styles.scss";

export const AttachmentEmpty = ({ children }: { children: ComponentChildren }) => {
  return <div className={styles["wrong-attachment-sign"]}>{children}</div>;
};
