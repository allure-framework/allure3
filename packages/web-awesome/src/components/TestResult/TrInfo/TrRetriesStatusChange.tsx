import { SvgIcon, Text, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import { type FunctionalComponent } from "preact";

import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

export const TrRetriesStatusChange: FunctionalComponent = () => {
  const { t } = useI18n("testSummary");
  const { t: tTransitions } = useI18n("transitions");

  return (
    <TooltipWrapper tooltipText={tTransitions("description.retriesStatusChange")}>
      <div className={styles["test-result-info-mark"]} data-testid="test-result-retries-status-change">
        <SvgIcon className={styles["metadata-icon"]} id={allureIcons.lineArrowsSwitchVertical1} size={"s"} />
        <Text type={"ui"} size={"s"}>
          {t("retriesStatusChange")}
        </Text>
      </div>
    </TooltipWrapper>
  );
};
