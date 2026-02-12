import { type TestEnvGroup, getRealEnvsCount } from "@allurereport/core-api";
import { formatDuration } from "@allurereport/core-api";
import { Counter, Heading, Loadable, Text, TooltipWrapper } from "@allurereport/web-components";
import clsx from "clsx";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import { TrInfoStatuses } from "@/components/TestResult/TrInfo/TrInfoStatuses";
import { TrNavigation } from "@/components/TestResult/TrNavigation";
import { TrPrevStatuses } from "@/components/TestResult/TrPrevStatuses";
import { TrSeverity } from "@/components/TestResult/TrSeverity";
import { TrStatus } from "@/components/TestResult/TrStatus";
import { TrTab, TrTabsList } from "@/components/TestResult/TrTabs";
import { testEnvGroupsStore } from "@/stores/env";
import { isSplitMode } from "@/stores/layout";
import { useI18n } from "@/stores/locale";
import { timestampToDate } from "@/utils/time";
import * as styles from "./styles.scss";

export type TrInfoProps = {
  testResult?: AwesomeTestResult;
};

export const TrInfo: FunctionalComponent<TrInfoProps> = ({ testResult }) => {
  const { name, status, muted, flaky, known, duration, labels, history, retries, attachments, stop } = testResult ?? {};
  const formattedDuration = formatDuration(duration as number);
  const fullDate = stop && timestampToDate(stop);
  const severity = labels?.find((label) => label.name === "severity")?.value ?? "normal";
  const { t } = useI18n("ui");
  const statuses = Object.entries({ flaky, muted, known }).filter(([, value]) => value);

  const Content = () => {
    return (
      <>
        {name && (
          <Heading data-testid="test-result-info-title" tag={"h1"} size={"s"} className={styles["test-result-name"]}>
            {name}
          </Heading>
        )}
        <div className={styles["test-result-info-data"]}>
          {Boolean(status) && <TrStatus status={status} />}
          {Boolean(history?.length) && <TrPrevStatuses history={history} />}
          <TrSeverity severity={severity} />
          {Boolean(statuses.length) && <TrInfoStatuses statuses={statuses} />}
          <TooltipWrapper tooltipText={fullDate}>
            <Text tag={"div"} size={"s"} bold className={styles["test-result-duration"]}>
              {formattedDuration}
            </Text>
          </TooltipWrapper>
        </div>
        <div className={styles["test-result-tabs"]}>
          <TrTabsList>
            <TrTab id="overview">{t("overview")}</TrTab>
            <TrTab id="history">
              <div className={styles["test-result-tab"]}>
                {t("history")}
                {Boolean(history?.length) && <Counter size={"s"} count={history?.length} />}
              </div>
            </TrTab>
            <TrTab id="retries">
              <div className={styles["test-result-tab"]}>
                {t("retries")}
                {Boolean(retries?.length) && <Counter size={"s"} count={retries?.length} />}
              </div>
            </TrTab>
            <TrTab id="attachments">
              <div className={styles["test-result-tab"]}>
                {t("attachments")}
                {Boolean(attachments?.length) && <Counter size={"s"} count={attachments?.length} />}
              </div>
            </TrTab>
            <Loadable<Record<string, TestEnvGroup>, TestEnvGroup | undefined>
              source={testEnvGroupsStore}
              transformData={(groups) => groups?.[testResult?.testCase?.id]}
              renderData={(group) => {
                const envsCount = getRealEnvsCount(group);

                return (
                  <TrTab id="environments">
                    <div className={styles["test-result-tab"]}>
                      {t("environments")}
                      {!!envsCount && <Counter size={"s"} count={envsCount} />}
                    </div>
                  </TrTab>
                );
              }}
            />
          </TrTabsList>
        </div>
      </>
    );
  };

  return (
    <div className={clsx(styles["test-result-info"], isSplitMode.value && styles.sticky)}>
      <TrNavigation testResult={testResult} />
      {testResult && <Content />}
    </div>
  );
};
