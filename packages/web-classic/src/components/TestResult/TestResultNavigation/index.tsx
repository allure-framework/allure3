import { Code, IconButton, Loadable, TooltipWrapper, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";
import { useI18n } from "@/stores";
import { testResultNavStore } from "@/stores/testResults";
import { copyToClipboard } from "@/utils/copyToClipboard";
import { navigateTo } from "@/utils/navigate";
import * as styles from "./styles.scss";

export type TestResultNavigationProps = {
  testResult?: AwesomeTestResult;
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

  return (
    <Loadable
      source={testResultNavStore}
      renderData={(data) => {
        const currentIndex = data.indexOf(id) + 1;
        return (
          <div className={styles["test-result-nav"]}>
            {fullName && <FullName />}
            {data && !testResult?.hidden && (
              <div className={styles["test-result-navigator"]}>
                <TooltipWrapper tooltipText={tooltip("prevTR")} isTriggerActive={currentIndex > 1}>
                  <IconButton
                    icon={allureIcons.lineArrowsChevronDown}
                    style={"ghost"}
                    isDisabled={currentIndex === data.length}
                    data-testid="test-result-nav-prev"
                    className={styles["test-result-nav-prev"]}
                    onClick={() => navigateTo(data[currentIndex])}
                  />
                </TooltipWrapper>
                <Code
                  data-testid="test-result-nav-current"
                  size={"s"}
                  className={styles["test-result-navigator-numbers"]}
                >
                  {currentIndex}/{data.length}
                </Code>
                <TooltipWrapper tooltipText={tooltip("nextTR")}>
                  <IconButton
                    icon={allureIcons.lineArrowsChevronDown}
                    style={"ghost"}
                    isDisabled={currentIndex <= 1}
                    data-testid="test-result-nav-next"
                    onClick={() => navigateTo(data[currentIndex - 2])}
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
