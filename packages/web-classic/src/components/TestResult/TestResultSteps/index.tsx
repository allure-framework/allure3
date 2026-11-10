import { Text, allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { ReportTestResult, ReportTestStepResult } from "types";

import { TestResultDropdown } from "@/components/TestResult/TestResultDropdown";
import { TestResultAttachment } from "@/components/TestResult/TestResultSteps/testResultAttachment";
import { TestResultStep } from "@/components/TestResult/TestResultSteps/testResultStep";
import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

export type TestResultStepsProps = {
  steps: ReportTestResult["steps"];
};

export const TestResultSteps: FunctionalComponent<TestResultStepsProps> = ({ steps }) => {
  const [isOpened, setIsOpen] = useState(true);

  const { t } = useI18n("execution");
  const { t: empty } = useI18n("empty");
  return (
    <div className={styles["test-result-steps"]}>
      <TestResultDropdown
        icon={allureIcons.lineHelpersPlayCircle}
        isOpened={isOpened}
        setIsOpen={setIsOpen}
        counter={steps?.length}
        title={t("body")}
      />
      {isOpened && (
        <div className={styles["test-result-steps-root"]}>
          {steps?.map((item: ReportTestStepResult, index) =>
            item.type === "step" ? (
              <TestResultStep item={item} stepIndex={index + 1} key={index} />
            ) : item.type === "attachment" ? (
              <TestResultAttachment item={item} stepIndex={index + 1} key={index} />
            ) : null,
          )}
        </div>
      )}
      {isOpened && !steps?.length && (
        <Text tag={"p"} size={"s"} className={styles["test-result-steps-empty"]} data-testid="test-result-steps-empty">
          {empty("no-test-steps-results")}
        </Text>
      )}
    </div>
  );
};
