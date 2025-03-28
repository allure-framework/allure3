import { Text } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

export type MetadataRowProps = {
  label: string;
};

export const MetadataRow: FunctionalComponent<MetadataRowProps> = ({ label, children }) => {
  return (
    <div className={styles["metadata-row"]}>
      <Text type={"ui"} size={"s"} bold className={styles.label}>
        {label}
      </Text>
      <Text type={"ui"} size={"s"}>
        {children}
      </Text>
    </div>
  );
};
