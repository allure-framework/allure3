import { formatDuration } from "@allurereport/core-api";
import { ArrowButton, IconButton, Text, TooltipWrapper, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import cx from "clsx";
import { type FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { TrError } from "@/components/TestResult/TrError";
import { useI18n } from "@/stores";
import { navigateTo, openInNewTab } from "@/stores/router";
import { timestampToDate } from "@/utils/time";
import type { AwesomeTestResult } from "../../../../types";
import * as styles from "./styles.scss";

export const TrEnvironmentItem: FunctionalComponent<{
  env: string;
  testResult: AwesomeTestResult;
  current?: boolean;
}> = ({ env, testResult, current = false }) => {
  const { status, error, stop, duration, id } = testResult;
  const [isOpened, setIsOpen] = useState(false);
  const hasEmptyError = !error || !Object.keys(error).length;
  const convertedStop = stop ? timestampToDate(stop) : "";
  const formattedDuration = formatDuration(duration as number);
  const { t } = useI18n("controls");
  const navigateUrl = id;

  return (
    <div data-testid={"test-result-env-item"}>
      <div className={styles["test-result-environment-item-header"]}>
        {!hasEmptyError && (
          <span onClick={() => setIsOpen(!isOpened)}>
            <ArrowButton isOpened={isOpened} icon={allureIcons.arrowsChevronDown} />
          </span>
        )}
        <div
          className={cx(styles["test-result-environment-item-wrap"], {
            [styles.current]: current,
          })}
          role={current ? undefined : "button"}
          onClick={(e) => {
            if (current) {
              return;
            }

            e.stopPropagation();
            navigateTo(navigateUrl);
          }}
        >
          <TreeItemIcon status={status} className={styles["test-result-environment-item-status"]} />
          <Text className={styles["test-result-environment-item-env"]} bold>
            {env}
          </Text>
          <Text className={styles["test-result-environment-item-text"]}>{convertedStop}</Text>
          <div className={styles["test-result-environment-item-info"]}>
            <Text type="ui" size={"s"} className={styles["test-result-environment-item-time"]}>
              {formattedDuration}
            </Text>
            {!current && (
              <TooltipWrapper tooltipText={t("openInNewTab")}>
                <IconButton
                  icon={allureIcons.lineGeneralLinkExternal}
                  style={"ghost"}
                  size={"s"}
                  className={styles["test-result-environment-item-link"]}
                  data-testid={"test-result-env-item-new-tab-button"}
                  onClick={(e) => {
                    e.stopPropagation();
                    openInNewTab(navigateUrl);
                  }}
                />
              </TooltipWrapper>
            )}
          </div>
        </div>
      </div>
      {isOpened && !hasEmptyError && (
        <div>
          <TrError status={status} {...error} />
        </div>
      )}
    </div>
  );
};
