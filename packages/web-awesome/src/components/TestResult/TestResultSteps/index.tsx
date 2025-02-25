import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AllureAwesomeTestResult, AllureAwesomeTestStepResult } from "types";
import { TestResultDropdown } from "@/components/TestResult/TestResultDropdown";
import { TestResultAttachment } from "@/components/TestResult/TestResultSteps/testResultAttachment";
import { TestResultStep } from "@/components/TestResult/TestResultSteps/testResultStep";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";
import * as styles from "./styles.scss";

const typeMap = {
  step: TestResultStep,
  attachment: TestResultAttachment,
} as const;

export type TestResultStepsProps = {
  steps: AllureAwesomeTestResult["steps"];
  id?: string;
};

type StepComponentProps = FunctionalComponent<{
  item?: AllureAwesomeTestStepResult;
  stepIndex?: number;
}>;

export const TestResultSteps: FunctionalComponent<TestResultStepsProps> = ({ steps, id }) => {
  const stepsId = `${id}-steps`;
  const isEarlyCollapsed = Boolean(!collapsedTrees.value.has(stepsId));
  const [traceVisible, setTraceVisible] = useState(false);
  const [isOpened, setIsOpen] = useState<boolean>(isEarlyCollapsed);

  const handleClick = () => {
    setIsOpen(!isOpened);
    toggleTree(stepsId);
  };

  const { t } = useI18n("execution");
  return (
    <div className={styles["test-result-steps"]}>
      <button type="button" onClick={() => setTraceVisible(!traceVisible)}>
        open trace
      </button>
      {traceVisible && (
        <div class={styles.modal}>
          <header>
            <p>Some text</p>
            <button type="button" onClick={() => setTraceVisible(false)}>
              Close
            </button>
          </header>
          <iframe src="https://trace.playwright.dev/?trace=https://demo.playwright.dev/reports/todomvc/data/cb0fa77ebd9487a5c899f3ae65a7ffdbac681182.zip" />
        </div>
      )}
      <TestResultDropdown
        icon={allureIcons.lineHelpersPlayCircle}
        isOpened={isOpened}
        setIsOpen={handleClick}
        counter={steps?.length}
        title={t("body")}
      />
      {isOpened && (
        <div className={styles["test-result-steps-root"]}>
          {steps?.map((item: AllureAwesomeTestStepResult, index) => {
            const { type } = item;
            const StepComponent: StepComponentProps = typeMap[type];
            return StepComponent ? <StepComponent item={item} stepIndex={index + 1} key={index} /> : null;
          })}
        </div>
      )}
    </div>
  );
};
