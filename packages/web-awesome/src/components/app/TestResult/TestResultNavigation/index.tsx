import type { FunctionalComponent } from "preact";
import type { AllureAwesomeTestResult } from "types";
import LineArrowsChevronDown from "@/assets/svg/line-arrows-chevron-down.svg";
import LineGeneralCopy3 from "@/assets/svg/line-general-copy-3.svg";
import { IconButton } from "@/components/commons/Button";
import { Loadable } from "@/components/commons/Loadable";
import { TooltipWrapper } from "@/components/commons/Tooltip";
import { Code } from "@/components/commons/Typography";
import { navigateTo } from "@/index";
import { useI18n } from "@/stores";
import { testResultNavStore } from "@/stores/testResults";
import { copyToClipboard } from "@/utils/copyToClipboard";
import * as styles from "./styles.scss";

export type TestResultNavigationProps = {
  testResult?: AllureAwesomeTestResult;
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
            icon={LineGeneralCopy3.id}
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
            {data && (
              <div className={styles["test-result-navigator"]}>
                <TooltipWrapper tooltipText={tooltip("prevTR")} isTriggerActive={currentIndex > 1}>
                  <IconButton
                    icon={LineArrowsChevronDown.id}
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
                    icon={LineArrowsChevronDown.id}
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
