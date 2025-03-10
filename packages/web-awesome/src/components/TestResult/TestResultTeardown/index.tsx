import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { AwesomeTestResult } from "types";
import { TestResultDropdown } from "@/components/TestResult/TestResultDropdown";
import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";
import { TestResultAttachment } from "@/components/TestResult/TestResultSteps/testResultAttachment";
import { TestResultStep } from "@/components/TestResult/TestResultSteps/testResultStep";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, toggleTree } from "@/stores/tree";

const typeMap = {
  before: TestResultStep,
  after: TestResultStep,
  step: TestResultStep,
  attachment: TestResultAttachment,
};

export type TestResultTeardownProps = {
  teardown: AwesomeTestResult["teardown"];
  id: string;
};

export const TestResultTeardown: FunctionalComponent<TestResultTeardownProps> = ({ teardown, id }) => {
  const teardownId = `${id}-teardown`;
  const isEarlyCollapsed = !collapsedTrees.value.has(teardownId);
  const [isOpened, setIsOpen] = useState<boolean>(isEarlyCollapsed);

  const handleClick = () => {
    setIsOpen(!isOpened);
    toggleTree(teardownId);
  };

  const { t } = useI18n("execution");

  return (
    <div className={styles["test-result-steps"]}>
      <TestResultDropdown
        icon={allureIcons.lineHelpersFlag}
        isOpened={isOpened}
        setIsOpen={handleClick}
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
