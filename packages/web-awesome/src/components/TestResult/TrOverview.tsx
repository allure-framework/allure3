import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";

import TestStepsEmpty from "@/components/TestResult/TestStepsEmpty";
import { TrDescription } from "@/components/TestResult/TrDescription";
import { TrError } from "@/components/TestResult/TrError";
import { TrLinks } from "@/components/TestResult/TrLinks";
import { TrMetadata } from "@/components/TestResult/TrMetadata";
import { TrParameters } from "@/components/TestResult/TrParameters";
import { TrPwTraces } from "@/components/TestResult/TrPwTraces";
import { TrSetup } from "@/components/TestResult/TrSetup";
import { TrSteps } from "@/components/TestResult/TrSteps";
import { TrTeardown } from "@/components/TestResult/TrTeardown";
import { currentTrId } from "@/stores/testResult";

import * as styles from "@/components/BaseLayout/styles.scss";

export type TrOverviewProps = {
  testResult?: AwesomeTestResult;
};

export const TrOverview: FunctionalComponent<TrOverviewProps> = ({ testResult }) => {
  const { error, parameters, groupedLabels, links, descriptionHtml, setup, steps, teardown, id, status } =
    testResult || {};
  const testResultId = id ?? currentTrId.value;
  const isNoSteps = !setup?.length && !steps?.length && !teardown?.length;
  const pwTraces = testResult?.attachments?.filter(
    (attachment) => attachment.link.contentType === "application/vnd.allure.playwright-trace",
  );

  return (
    <>
      {Boolean(error?.message) && (
        <div className={styles["test-result-errors"]}>
          <TrError {...error} status={status} />
        </div>
      )}
      {Boolean(pwTraces?.length) && <TrPwTraces pwTraces={pwTraces} />}
      {Boolean(parameters?.length) && <TrParameters id={testResultId} parameters={parameters} />}
      {Boolean(groupedLabels && Object.keys(groupedLabels || {})?.length) && (
        <TrMetadata id={testResultId} testResult={testResult} />
      )}
      {Boolean(links?.length) && <TrLinks id={testResultId} links={links} />}
      {Boolean(descriptionHtml) && <TrDescription id={testResultId} descriptionHtml={descriptionHtml} />}
      <div className={styles["test-results"]}>
        {isNoSteps && <TestStepsEmpty />}
        {Boolean(setup?.length) && <TrSetup id={testResultId} setup={setup} />}
        {Boolean(steps?.length) && <TrSteps id={testResultId} steps={steps} />}
        {Boolean(teardown?.length) && <TrTeardown id={testResultId} teardown={teardown} />}
      </div>
    </>
  );
};
