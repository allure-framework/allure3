import { Text } from "@allurereport/web-components";
import { clsx } from "clsx";
import type { FunctionComponent } from "preact";
import type { MetadataProps } from "@/components/ReportMetadata/MetadataItem";
import * as styles from "@/components/ReportMetadata/styles.scss";

export const MetadataTestType: FunctionComponent<MetadataProps> = ({ status, count }) => {
  return (
    <div data-testid="metadata-value" className={styles["metadata-test-type"]}>
      <div className={clsx(styles["metadata-color-badge"], styles?.[`status-${status}`])} />
      <Text type={"ui"} size={"m"} bold>
        {count}
      </Text>
    </div>
  );
};
