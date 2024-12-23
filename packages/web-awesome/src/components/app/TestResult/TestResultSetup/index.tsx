import i18n from "i18next";
import { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import { AllureAwesomeTestResult } from "types";
import LineTimeClockStopwatch from "@/assets/svg/line-time-clock-stopwatch.svg";
import { TestResultDropdown } from "@/components/app/TestResult/TestResultDropdown";
import * as styles from "@/components/app/TestResult/TestResultSteps/styles.scss";
import { TestResultAttachment } from "@/components/app/TestResult/TestResultSteps/testResultAttachment";
import { TestResultStep } from "@/components/app/TestResult/TestResultSteps/testResultStep";
import { useI18n } from "@/stores/locale";

const typeMap = {
  before: TestResultStep,
  after: TestResultStep,
  step: TestResultStep,
  attachment: TestResultAttachment,
};

export type TestResultSetupProps = {
  setup: AllureAwesomeTestResult["setup"];
};

export const TestResultSetup: FunctionalComponent<TestResultSetupProps> = ({ setup }) => {
  const [isOpened, setIsOpen] = useState(false);
  const { t } = useI18n("execution");

  return (
    <div className={styles["test-result-steps"]}>
      <TestResultDropdown
        icon={LineTimeClockStopwatch.id}
        isOpened={isOpened}
        setIsOpen={setIsOpen}
        counter={setup?.length}
        title={t("setup")}
      />
      {isOpened && (
        <div className={styles["test-result-steps-root"]}>
          {setup?.map((item, key) => {
            const StepComponent = typeMap[item.type];
            return StepComponent ? (
              // FIXME: use proper type in the StepComponent component
              // @ts-ignore
              <StepComponent item={item} stepIndex={key + 1} key={key} className={styles["test-result-step-root"]} />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};
