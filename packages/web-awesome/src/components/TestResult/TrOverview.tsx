import type { FunctionalComponent } from "preact";
import type { AwesomeTestResult } from "types";

import { getBodyItems } from "@/components/TestResult/bodyItems";
import TestStepsEmpty from "@/components/TestResult/TestStepsEmpty";
import { TrDescription } from "@/components/TestResult/TrDescription";
import { TrLinks } from "@/components/TestResult/TrLinks";
import { TrMetadata } from "@/components/TestResult/TrMetadata";
import { TrParameters } from "@/components/TestResult/TrParameters";
import { TrPwTraces } from "@/components/TestResult/TrPwTraces";
import { TrSetup } from "@/components/TestResult/TrSetup";
import { TrSteps } from "@/components/TestResult/TrSteps";
import { TrTeardown } from "@/components/TestResult/TrTeardown";
import { useI18n } from "@/stores/locale";
import { currentTrId } from "@/stores/testResult";

import * as styles from "@/components/BaseLayout/styles.scss";

export type TrOverviewProps = {
  testResult?: AwesomeTestResult;
};

export const TrOverview: FunctionalComponent<TrOverviewProps> = ({ testResult }) => {
  const { parameters, groupedLabels, links, descriptionHtml, setup, teardown, id } = testResult || {};
  const testResultId = id ?? currentTrId.value;
  const { t } = useI18n("ui");
  const bodyItems = getBodyItems(testResult, t("error"));
  const isNoSteps = !setup?.length && !bodyItems.length && !teardown?.length;
  const pwTraces = testResult?.attachments?.filter(
    (attachment) => attachment.link.contentType === "application/vnd.allure.playwright-trace",
  );

  return (
    <>
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
        {Boolean(bodyItems.length) && <TrSteps id={testResultId} bodyItems={bodyItems} />}
        {Boolean(teardown?.length) && <TrTeardown id={testResultId} teardown={teardown} />}
      </div>
    </>
  );
};
