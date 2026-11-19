import { allureIcons } from "@allurereport/web-components";
import type { FunctionalComponent } from "preact";
import { useState } from "preact/hooks";
import type { ReportTestResult } from "types";

import { TestResultDropdown } from "@/components/TestResult/TestResultDropdown";
import { hasFailedFixture } from "@/components/TestResult/TestResultError/errorDetails";
import { TestResultStep } from "@/components/TestResult/TestResultSteps/testResultStep";
import { useI18n } from "@/stores/locale";

import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";

export type TestResultTeardownProps = {
  teardown: ReportTestResult["teardown"];
};

export const TestResultTeardown: FunctionalComponent<TestResultTeardownProps> = ({ teardown }) => {
  const [isOpened, setIsOpen] = useState(() => hasFailedFixture(teardown));
  const { t } = useI18n("execution");

  return (
    <div className={styles["test-result-steps"]}>
      <TestResultDropdown
        icon={allureIcons.lineHelpersFlag}
        isOpened={isOpened}
        setIsOpen={setIsOpen}
        counter={teardown?.length}
        title={t("teardown")}
      />
      {isOpened && (
        <div className={styles["test-result-steps-root"]}>
          {teardown?.map((item, key) => (
            <TestResultStep item={item} stepIndex={key + 1} key={item.id ?? key} />
          ))}
        </div>
      )}
    </div>
  );
};
