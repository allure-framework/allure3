import { isDisplayableTestError } from "@allurereport/web-commons";
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
    status,
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
      {isDisplayableTestError(error) && (
        <div className={styles["test-result-errors"]}>
          <TestResultError {...error} status={status} />
        </div>
      )}
      {parameters && parameters.length > 0 && <TestResultParameters parameters={parameters} />}
      {Boolean(groupedLabels && Object.keys(groupedLabels || {})?.length) && (
        <TestResultMetadata testResult={testResult} />
      )}
      {links && links.length > 0 && <TestResultLinks links={links} />}
      {Boolean(descriptionHtml) && <TestResultDescription section="description" html={descriptionHtml} />}
      {Boolean(preconditionHtml) && <TestResultDescription section="precondition" html={preconditionHtml} />}
      <div className={styles["test-results"]}>
        {setup && setup.length > 0 && <TestResultSetup setup={setup} />}
        {Boolean(steps?.length || (!setup?.length && !teardown?.length)) && <TestResultSteps steps={steps ?? []} />}
        {teardown && teardown.length > 0 && <TestResultTeardown teardown={teardown} />}
      </div>
      {Boolean(expectedResultHtml) && <TestResultDescription section="expectedResult" html={expectedResultHtml} />}
    </>
  );
};
