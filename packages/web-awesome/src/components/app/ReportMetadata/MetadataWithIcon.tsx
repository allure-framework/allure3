import type { FunctionComponent } from "preact";
import notifications from "@/assets/svg/line-alerts-notification-box.svg";
import refresh from "@/assets/svg/line-arrows-refresh-ccw-1.svg";
import lineGeneralZap from "@/assets/svg/line-general-zap.svg";
import type { MetadataProps } from "@/components/app/ReportMetadata/MetadataItem";
import { SvgIcon } from "@/components/commons/SvgIcon";
import { Text } from "@/components/commons/Typography";
import * as styles from "./styles.scss";

const icons = {
  flaky: lineGeneralZap.id,
  retry: refresh.id,
  new: notifications.id,
};

export const MetadataWithIcon: FunctionComponent<MetadataProps> = ({ type, count }) => {
  return (
    <div data-testid="metadata-value" className={styles["metadata-with-icon"]}>
      {type !== "all" && <SvgIcon className={styles["metadata-icon"]} id={icons[type]} size={"s"} />}
      <Text size={"m"} bold>
        {count}
      </Text>
    </div>
  );
};
