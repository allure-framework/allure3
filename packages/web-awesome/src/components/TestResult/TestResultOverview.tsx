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
import TestStepsEmpty from "@/components/TestResult/TestStepsEmpty";

export type TestResultOverviewProps = {
  testResult?: AllureAwesomeTestResult;
};

export const TestResultOverview: FunctionalComponent<TestResultOverviewProps> = ({ testResult }) => {
  const { error, parameters, groupedLabels, links, description, setup, steps, teardown } = testResult || {};
  const isNoSteps = !setup?.length && !steps.length && !teardown.length;

  return (
    <>
      {Boolean(error?.message) && (
        <div className={styles["test-result-errors"]}>
          <TestResultError {...error} />
        </div>
      )}
      {Boolean(parameters?.length) && <TestResultParameters parameters={parameters} />}
      {Boolean(groupedLabels && Object.keys(groupedLabels || {})?.length) && (
        <TestResultMetadata testResult={testResult} />
      )}
      {Boolean(links?.length) && <TestResultLinks links={links} />}
      {Boolean(description) && <TestResultDescription description={description} />}
      <div className={styles["test-results"]}>
        {isNoSteps && <TestStepsEmpty />}
        {Boolean(setup?.length) && <TestResultSetup setup={setup} />}
        {Boolean(steps?.length) && <TestResultSteps steps={steps} />}
        {Boolean(teardown?.length) && <TestResultTeardown teardown={teardown} />}
      </div>
    </>
  );
};
