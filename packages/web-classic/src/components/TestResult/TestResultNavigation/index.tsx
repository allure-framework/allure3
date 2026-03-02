import { Code, IconButton, Loadable, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { ClassicTestResult } from "types";
import { useI18n } from "@/stores";
import { route } from "@/stores/router";
import { testResultNavStore } from "@/stores/testResults";
import { copyToClipboard } from "@/utils/copyToClipboard";
import { navigateTo } from "@/utils/navigate";
import * as styles from "./styles.scss";

export type TestResultNavigationProps = {
  testResult?: ClassicTestResult;
};

export const TestResultNavigation: FunctionalComponent<TestResultNavigationProps> = ({ testResult }) => {
  const { fullName, id: testResultId } = testResult ?? {};
  const id = testResultId || "";
  const { t: tooltip } = useI18n("controls");
  const FullName = () => {
    return (
      <div data-testid="test-result-fullname" className={styles["test-result-fullName"]}>
        <TooltipWrapper tooltipText={tooltip("clipboard")} tooltipTextAfterClick={tooltip("clipboardSuccess")}>
          <IconButton
            data-testid="test-result-fullname-copy"
            style={"ghost"}
            size={"s"}
            icon={allureIcons.lineGeneralCopy3}
            onClick={() => copyToClipboard(fullName)}
          />
        </TooltipWrapper>
        <Code tag={"div"} size={"s"} className={styles["test-result-fullName-text"]}>
          {fullName && fullName}
        </Code>
      </div>
    );
  };

  const tabName = route.value.tabName || "suites";
  const buildHash = (testResultId: string) => `${tabName}/root/${testResultId}`;

  return (
    <Loadable
      source={testResultNavStore}
      renderData={(data) => {
        const currentIndex = data.indexOf(id) + 1;
        const canGoPrev = currentIndex > 1;
        const canGoNext = currentIndex < data.length;
        return (
          <div className={styles["test-result-nav"]}>
            {fullName && <FullName />}
            {data && data.length > 0 && !testResult?.hidden && (
              <div className={styles["test-result-navigator"]}>
                <TooltipWrapper tooltipText={tooltip("prevTR")} isTriggerActive={canGoPrev}>
                  <IconButton
                    icon={allureIcons.lineArrowsChevronDown}
                    style={"ghost"}
                    isDisabled={!canGoPrev}
                    data-testid="test-result-nav-prev"
                    className={styles["test-result-nav-prev"]}
                    onClick={() => navigateTo(buildHash(data[currentIndex - 2]))}
                  />
                </TooltipWrapper>
                <Code
                  data-testid="test-result-nav-current"
                  size={"s"}
                  className={styles["test-result-navigator-numbers"]}
                >
                  {currentIndex}/{data.length}
                </Code>
                <TooltipWrapper tooltipText={tooltip("nextTR")} isTriggerActive={canGoNext}>
                  <IconButton
                    icon={allureIcons.lineArrowsChevronDown}
                    style={"ghost"}
                    isDisabled={!canGoNext}
                    data-testid="test-result-nav-next"
                    onClick={() => navigateTo(buildHash(data[currentIndex]))}
                  />
                </TooltipWrapper>
              </div>
            )}
          </div>
        );
      }}
    />
  );
};
