import { Text } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

export type MetadataRowProps = {
  label: string;
};

export const MetadataRow: FunctionalComponent<MetadataRowProps> = ({ label, children }) => {
  return (
    <div className={styles["metadata-row"]}>
      <Text type={"ui"} size={"m"} className={styles.label}>
        {label}
      </Text>
      <Text type={"ui"} size={"m"} bold className={styles.number}>
        {children}
      </Text>
    </div>
  );
};
