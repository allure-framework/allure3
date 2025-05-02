import { Text, TooltipWrapper } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

export type MetadataRowProps = {
  label: string;
  status: string;
};

export const MetadataRow: FunctionalComponent<MetadataRowProps> = ({ status, label, children }) => {
  return (
    <div className={styles["metadata-row"]}>
      <TooltipWrapper tooltipText={label}>
        <Text
          className={clsx(styles["metadata-row-number"], styles[`status-${status.toLowerCase()}`])}
          type={"ui"}
          size={"s"}
          tag={"div"}
        >
          {children}
        </Text>
      </TooltipWrapper>
    </div>
  );
};
