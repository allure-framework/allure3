import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { TestResultDropdown } from "@/components/TestResult/TestResultDropdown";
import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";
import { TestResultAttachment } from "@/components/TestResult/TestResultSteps/testResultAttachment";
import { TestResultStep } from "@/components/TestResult/TestResultSteps/testResultStep";
import { useI18n } from "@/stores/locale";

const typeMap = {
  before: TestResultStep,
  after: TestResultStep,
  step: TestResultStep,
  attachment: TestResultAttachment,
};

export type TestResultSetupProps = {
  setup: AwesomeTestResult["setup"];
};

export const TestResultSetup: FunctionalComponent<TestResultSetupProps> = ({ setup }) => {
  const [isOpened, setIsOpen] = useState(false);
  const { t } = useI18n("execution");

  return (
    <div className={styles["test-result-steps"]}>
      <TestResultDropdown
        icon={allureIcons.lineTimeClockStopwatch}
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
