import { capitalize } from "@allurereport/core-api";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";

import { useI18n } from "@/stores";

import * as styles from "./styles.scss";

export const TrFlaky: FunctionalComponent = () => {
  const { t } = useI18n("filters");

  return (
    <div className={styles["test-result-info-flaky"]}>
      <SvgIcon className={styles["metadata-icon"]} id={allureIcons.lineIconBomb2} size={"s"} />
      <Text type={"ui"} size={"s"}>
        {capitalize(t("flaky"))}
      </Text>
    </div>
  );
};
