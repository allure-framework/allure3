import type { FunctionalComponent } from "preact";
import type { ReportTestResult } from "types";

import { TestResultDescription } from "@/components/TestResult/TestResultDescription";
import { TestResultError } from "@/components/TestResult/TestResultError";
import { TestResultLinks } from "@/components/TestResult/TestResultLinks";
import { TestResultMetadata } from "@/components/TestResult/TestResultMetadata";
import { TestResultParameters } from "@/components/TestResult/TestResultParameters";
import { TestResultSetup } from "@/components/TestResult/TestResultSetup";
import { TestResultSteps } from "@/components/TestResult/TestResultSteps";
import { TestResultTeardown } from "@/components/TestResult/TestResultTeardown";

import * as styles from "@/components/BaseLayout/styles.scss";

export type TestResultOverviewProps = {
  testResult?: ReportTestResult;
};

export const TestResultOverview: FunctionalComponent<TestResultOverviewProps> = ({ testResult }) => {
  const {
    error,
    parameters,
    groupedLabels,
    links,
    descriptionHtml,
    preconditionHtml,
    expectedResultHtml,
    setup,
    steps,
    teardown,
  } = testResult || {};

  return (
    <>
      {Boolean(error?.message) && (
        <div className={styles["test-result-errors"]}>
          <TestResultError {...error} />
        </div>
      )}
      {parameters && parameters.length > 0 && <TestResultParameters parameters={parameters} />}
      {Boolean(groupedLabels && Object.keys(groupedLabels || {})?.length) && (
        <TestResultMetadata testResult={testResult} />
      )}
      {Boolean(links?.length) && <TestResultLinks links={links} />}
      {Boolean(descriptionHtml) && <TestResultDescription section="description" html={descriptionHtml} />}
      {Boolean(preconditionHtml) && <TestResultDescription section="precondition" html={preconditionHtml} />}
      <div className={styles["test-results"]}>
        {setup && setup.length > 0 && <TestResultSetup setup={setup} />}
        {steps && steps.length > 0 && <TestResultSteps steps={steps} />}
        {teardown && teardown.length > 0 && <TestResultTeardown teardown={teardown} />}
      </div>
      {Boolean(expectedResultHtml) && <TestResultDescription section="expectedResult" html={expectedResultHtml} />}
    </>
  );
};
