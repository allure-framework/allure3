import type { FunctionalComponent } from "preact";
import type { ReportTestResult } from "types";

import { getBodyItems, hasDisplayableTestStatusDetails } from "@/components/TestResult/bodyItems";
import TestStepsEmpty from "@/components/TestResult/TestStepsEmpty";
import { TrError } from "@/components/TestResult/TrError";
import { TrLinks } from "@/components/TestResult/TrLinks";
import { TrMetadata } from "@/components/TestResult/TrMetadata";
import { TrParameters } from "@/components/TestResult/TrParameters";
import { TrPwTraces } from "@/components/TestResult/TrPwTraces";
import { TrRichTextSection } from "@/components/TestResult/TrRichTextSection";
import { TrSetup } from "@/components/TestResult/TrSetup";
import { TrSteps } from "@/components/TestResult/TrSteps";
import { TrTeardown } from "@/components/TestResult/TrTeardown";
import { useTestResultOverviewFocusScroll } from "@/hooks/useTestResultOverviewFocusScroll";
import { useI18n } from "@/stores/locale";
import { currentTrId } from "@/stores/testResult";

import * as styles from "@/components/BaseLayout/styles.scss";

export type TrOverviewProps = {
  testResult?: ReportTestResult;
};

export const TrOverview: FunctionalComponent<TrOverviewProps> = ({ testResult }) => {
  useTestResultOverviewFocusScroll();
  const {
    parameters,
    groupedLabels,
    links,
    descriptionHtml,
    preconditionHtml,
    expectedResultHtml,
    setup,
    teardown,
    id,
    error,
    status,
  } = testResult || {};
  const testResultId = id ?? currentTrId.value;
  const { t } = useI18n("ui");
  const bodyItems = getBodyItems(testResult, t("error"));
  const isNoSteps = !setup?.length && !bodyItems.length && !teardown?.length;
  const pwTraces = testResult?.attachments?.filter(
    (attachment) => attachment.link.contentType === "application/vnd.allure.playwright-trace",
  );
  const showTopError = hasDisplayableTestStatusDetails(status, error);

  return (
    <>
      {showTopError && (
        <div className={styles["test-result-errors"]}>
          <TrError {...error} status={status} />
        </div>
      )}
      {pwTraces && pwTraces.length > 0 && <TrPwTraces pwTraces={pwTraces} />}
      {parameters && parameters.length > 0 && <TrParameters id={testResultId} parameters={parameters} />}
      {!!(groupedLabels && Object.keys(groupedLabels || {})?.length) && (
        <TrMetadata id={testResultId} testResult={testResult} />
      )}
      {links && links.length > 0 && <TrLinks id={testResultId} links={links} />}
      {descriptionHtml && <TrRichTextSection id={testResultId} section="description" html={descriptionHtml} />}
      {preconditionHtml && <TrRichTextSection id={testResultId} section="precondition" html={preconditionHtml} />}
      <div className={styles["test-results"]}>
        {isNoSteps && <TestStepsEmpty />}
        {setup && setup.length > 0 && <TrSetup id={testResultId} setup={setup} />}
        {!!bodyItems.length && <TrSteps id={testResultId} bodyItems={bodyItems} />}
        {teardown && teardown.length > 0 && <TrTeardown id={testResultId} teardown={teardown} />}
        {expectedResultHtml && (
          <TrRichTextSection id={testResultId} section="expectedResult" html={expectedResultHtml} />
        )}
      </div>
    </>
  );
};
