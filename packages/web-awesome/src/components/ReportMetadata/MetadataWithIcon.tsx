import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { FunctionComponent } from "preact";
import type { MetadataProps } from "@/components/ReportMetadata/MetadataItem";
import * as styles from "./styles.scss";

const icons: Record<string, string> = {
  flaky: allureIcons.lineIconBomb2,
  retries: allureIcons.lineArrowsRefreshCcw1,
  new: allureIcons.lineAlertsNew,
};

export const MetadataWithIcon: FunctionComponent<MetadataProps> = ({ type, count }) => (
  <div data-testid="metadata-value" className={styles["metadata-with-icon"]}>
    {type !== "all" && <SvgIcon className={styles["metadata-icon"]} id={icons[type]} size={"s"} />}
    <Text size={"m"} bold>
      {count}
    </Text>
  </div>
);
