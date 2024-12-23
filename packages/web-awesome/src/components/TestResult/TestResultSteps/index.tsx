import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AllureAwesomeTestResult, AllureAwesomeTestStepResult } from "types";
import LineHelpersPlayCircle from "@/assets/svg/line-helpers-play-circle.svg";
import { TestResultDropdown } from "@/components/TestResult/TestResultDropdown";
import { TestResultAttachment } from "@/components/TestResult/TestResultSteps/testResultAttachment";
import { TestResultStep } from "@/components/TestResult/TestResultSteps/testResultStep";
import { useI18n } from "@/stores/locale";
import * as styles from "./styles.scss";

const typeMap = {
  step: TestResultStep,
  attachment: TestResultAttachment,
} as const;

export type TestResultStepsProps = {
  steps: AllureAwesomeTestResult["steps"];
};

type StepComponentProps = FunctionalComponent<{
  item?: AllureAwesomeTestStepResult;
  stepIndex?: number;
}>;

export const TestResultSteps: FunctionalComponent<TestResultStepsProps> = ({ steps }) => {
  const [isOpened, setIsOpen] = useState(true);

  const { t } = useI18n("execution");
  return (
    <div className={styles["test-result-steps"]}>
      <TestResultDropdown
        icon={LineHelpersPlayCircle.id}
        isOpened={isOpened}
        setIsOpen={setIsOpen}
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
