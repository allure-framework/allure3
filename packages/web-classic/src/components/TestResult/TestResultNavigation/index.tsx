import { copyToClipboard } from "@allurereport/web-commons";
import { Code, IconButton, Loadable, Menu, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { ReportTestResult } from "types";

import { useI18n } from "@/stores";
import { navigateTo, route } from "@/stores/router";
import { testResultNavStore } from "@/stores/testResults";
import { getAdjacentTestResultIds, getTestResultHash } from "@/utils/testResultNavigation";

import * as styles from "./styles.scss";

export type TestResultNavigationProps = {
  testResult?: ReportTestResult;
};

const TestResultCopyMenu: FunctionalComponent<{
  fullName?: string;
  testCaseId?: string;
  historyId?: string;
}> = ({ fullName, testCaseId, historyId }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n("ui");

  const copyValue = (value: string) => {
    copyToClipboard(value);
    setCopied(true);
  };

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 750);

    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div data-testid="test-result-fullname" className={styles["test-result-fullName"]}>
      <Menu
        size="s"
        placement="bottom-start"
        menuTriggerWrapper="span"
        menuTrigger={({ isOpened, onClick }) => (
          <IconButton
            aria-label={t("copy")}
            data-testid="test-result-fullname-copy"
            style={"ghost"}
            size={"s"}
            icon={copied ? allureIcons.lineGeneralCheck : allureIcons.lineGeneralCopy3}
            isActive={isOpened}
            onClick={onClick}
          />
        )}
      >
        <div data-testid="test-result-copy-menu">
          <Menu.Section>
            {fullName && (
              <Menu.Item dataTestId="test-result-copy-fullname" onClick={() => copyValue(fullName)}>
                {t("fullname")}
              </Menu.Item>
            )}
            {testCaseId && (
              <Menu.Item dataTestId="test-result-copy-test-case-id" onClick={() => copyValue(testCaseId)}>
                {t("test-case-id")}
              </Menu.Item>
            )}
            {historyId && (
              <Menu.Item dataTestId="test-result-copy-history-id" onClick={() => copyValue(historyId)}>
                {t("history-id")}
              </Menu.Item>
            )}
          </Menu.Section>
        </div>
      </Menu>
      {fullName && (
        <Code tag={"div"} size={"s"} className={styles["test-result-fullName-text"]}>
          {fullName}
        </Code>
      )}
    </div>
  );
};

const NavArrow: FunctionalComponent<{ type: "prev" | "next"; trId?: string }> = ({ type, trId }) => {
  const { t: tooltip } = useI18n("controls");
  const isPrev = type === "prev";
  const icon = isPrev ? allureIcons.lineArrowsChevronUp : allureIcons.lineArrowsChevronDown;
  const testId = `test-result-nav-${type}`;

  if (!trId) {
    return <IconButton icon={icon} style={"ghost"} isDisabled data-testid={testId} />;
  }

  return (
    <TooltipWrapper tooltipText={tooltip(isPrev ? "prevTR" : "nextTR")}>
      <IconButton
        icon={icon}
        style={"ghost"}
        data-testid={testId}
        onClick={() => navigateTo(getTestResultHash(route.value, trId))}
      />
    </TooltipWrapper>
  );
};

export const TestResultNavigation: FunctionalComponent<TestResultNavigationProps> = ({ testResult }) => {
  const { fullName, id: testResultId, testCase, retryHash } = testResult ?? {};
  const id = testResultId || "";
  const hasCopyMenu = Boolean(fullName || testCase?.id || retryHash);

  return (
    <Loadable
      source={testResultNavStore}
      renderData={(data) => {
        const { prevId, nextId, position } = getAdjacentTestResultIds(data ?? [], id);

        return (
          <div className={styles["test-result-nav"]}>
            {hasCopyMenu && <TestResultCopyMenu fullName={fullName} testCaseId={testCase?.id} historyId={retryHash} />}
            {Boolean(data?.length) && testResult && !testResult.isRetry && (
              <div className={styles["test-result-navigator"]}>
                <NavArrow type="prev" trId={prevId} />
                <Code
                  data-testid="test-result-nav-current"
                  size={"s"}
                  className={styles["test-result-navigator-numbers"]}
                >
                  {position}/{data.length}
                </Code>
                <NavArrow type="next" trId={nextId} />
              </div>
            )}
          </div>
        );
      }}
    />
  );
};
