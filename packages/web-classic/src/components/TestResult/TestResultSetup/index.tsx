import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { ReportTestResult } from "types";

import { TestResultDropdown } from "@/components/TestResult/TestResultDropdown";
import { hasFailedFixture } from "@/components/TestResult/TestResultError/errorDetails";
import { TestResultStep } from "@/components/TestResult/TestResultSteps/testResultStep";
import { useI18n } from "@/stores/locale";

import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";

export type TestResultSetupProps = {
  setup: ReportTestResult["setup"];
};

export const TestResultSetup: FunctionalComponent<TestResultSetupProps> = ({ setup }) => {
  const [isOpened, setIsOpen] = useState(() => hasFailedFixture(setup));
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
          {setup?.map((item, key) => (
            <TestResultStep item={item} stepIndex={key + 1} key={item.id ?? key} />
          ))}
        </div>
      )}
    </div>
  );
};
