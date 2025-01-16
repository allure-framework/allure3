import type { FunctionalComponent } from "preact";
import type { AllureAwesomeTestResult } from "types";
import * as styles from "@/components/BaseLayout/styles.scss";
import { TestResultDescription } from "@/components/TestResult/TestResultDescription";
import { TestResultError } from "@/components/TestResult/TestResultError";
import { TestResultLinks } from "@/components/TestResult/TestResultLinks";
import { TestResultMetadata } from "@/components/TestResult/TestResultMetadata";
import { TestResultParameters } from "@/components/TestResult/TestResultParameters";
import { TestResultSetup } from "@/components/TestResult/TestResultSetup";
import { TestResultSteps } from "@/components/TestResult/TestResultSteps";
import { TestResultTeardown } from "@/components/TestResult/TestResultTeardown";

export type TestResultOverviewProps = {
  testResult?: AllureAwesomeTestResult;
};

export const TestResultOverview: FunctionalComponent<TestResultOverviewProps> = ({ testResult }) => {
  const { message, trace, parameters, groupedLabels, links, description, setup, testStage, afterStages } =
    testResult || {};
  console.log(testStage);

  return (
    <>
      {Boolean(message) && (
        <div className={styles["test-result-errors"]}>
          <TestResultError message={message} trace={trace} />
        </div>
      )}
      {Boolean(parameters?.length) && <TestResultParameters parameters={parameters} />}
      {Boolean(groupedLabels && Object.keys(groupedLabels || {})?.length) && (
        <TestResultMetadata testResult={testResult} />
      )}
      {Boolean(links?.length) && <TestResultLinks links={links} />}
      {Boolean(description) && <TestResultDescription description={description} />}
      <div className={styles["test-results"]}>
        {testStage.length}
        {Boolean(setup?.length) && <TestResultSetup setup={setup} />}
        {Boolean(testStage.steps?.length) && <TestResultSteps steps={testStage.steps} />}
        {Boolean(afterStages?.length) && <TestResultTeardown teardown={afterStages} />}
      </div>
    </>
  );
};
