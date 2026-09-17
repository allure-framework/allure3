import { Text } from "@allurereport/web-components";
import { clsx } from "clsx";
import type { FunctionComponent } from "preact";

import type { MetadataProps } from "@/components/ReportMetadata/MetadataItem";

import * as styles from "@/components/ReportMetadata/styles.scss";

export const MetadataTestType: FunctionComponent<MetadataProps> = ({ status, count }) => {
  return (
    <span data-testid="metadata-value" className={styles["metadata-test-type"]}>
      <span className={clsx(styles["metadata-color-badge"], styles?.[`status-${status}`])} />
      <Text type={"ui"} size={"m"} bold>
        {count}
      </Text>
    </span>
  );
};
