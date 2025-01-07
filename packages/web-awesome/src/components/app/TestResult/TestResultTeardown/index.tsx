import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AllureAwesomeTestResult } from "types";
import lineHelpersFlag from "@/assets/svg/line-helpers-flag.svg";
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

export type TestResultTeardownProps = {
  teardown: AllureAwesomeTestResult["teardown"];
};

export const TestResultTeardown: FunctionalComponent<TestResultTeardownProps> = ({ teardown }) => {
  const [isOpened, setIsOpen] = useState(false);
  const { t } = useI18n("execution");

  return (
    <div className={styles["test-result-steps"]}>
      <TestResultDropdown
        icon={lineHelpersFlag.id}
        isOpened={isOpened}
        setIsOpen={setIsOpen}
        counter={teardown?.length}
        title={t("teardown")}
      />
      {isOpened && (
        <div className={styles["test-result-steps-root"]}>
          {teardown?.map((item, key) => {
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
