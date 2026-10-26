import type { DefaultTestStepResult } from "@allurereport/core-api";
import { Code, LinkifiedText, allureIcons } from "@allurereport/web-components";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import type { ReportFixtureResult } from "types";

import { ArrowButton } from "@/components/ArrowButton";
import { MetadataList } from "@/components/Metadata";
import { type MetadataItem } from "@/components/ReportMetadata";
import { TestResultError } from "@/components/TestResult/TestResultError";
import { getStepError, shouldShowStepError } from "@/components/TestResult/TestResultError/errorDetails";
import { TestResultAttachment } from "@/components/TestResult/TestResultSteps/testResultAttachment";
import { TestResultStepInfo } from "@/components/TestResult/TestResultSteps/testResultStepInfo";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";

import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";

/**
 * A step row renders regular steps as well as setup/teardown fixtures.
 */
export type TestResultStepItem = DefaultTestStepResult | ReportFixtureResult;

const getParameters = (item: TestResultStepItem) => ("parameters" in item ? item.parameters : undefined);

export const TestResultStepParameters = (props: { parameters: DefaultTestStepResult["parameters"] }) => {
  const { parameters } = props;

  return (
    <div className={styles["test-result-parameters"]}>
      <MetadataList size={"s"} envInfo={parameters as unknown as MetadataItem[]} columns={1} />
    </div>
  );
};

export const TestResultStepsContent = (props: { item: TestResultStepItem }) => {
  const { item } = props;
  const parameters = getParameters(item);

  return (
    <div data-testid="test-result-step-content" className={styles["test-result-step-content"]}>
      {Boolean(parameters?.length) && <TestResultStepParameters parameters={parameters} />}
      {shouldShowStepError(item) && (
        <div className={styles["test-result-step-error"]}>
          <TestResultError {...getStepError(item)} status={item.status} />
        </div>
      )}
      {Boolean(item?.steps?.length) && (
        <>
          {item.steps?.map((subItem, key) => {
            if (subItem.type === "step") {
              return <TestResultStep stepIndex={key + 1} key={key} item={subItem} />;
            }

            if (subItem.type === "attachment") {
              return <TestResultAttachment stepIndex={key + 1} key={key} item={subItem} />;
            }

            return null;
          })}
        </>
      )}
    </div>
  );
};

export const TestResultStep: FunctionComponent<{
  item: TestResultStepItem;
  stepIndex?: number;
  className?: string;
}> = ({ item, stepIndex }) => {
  const [isOpened, setIsOpen] = useState(false);
  const hasContent = Boolean(item?.steps?.length || getParameters(item)?.length || shouldShowStepError(item));

  return (
    <div data-testid="test-result-step" className={styles["test-result-step"]}>
      <div
        data-testid="test-result-step-header"
        className={styles["test-result-step-header"]}
        onClick={() => setIsOpen(!isOpened)}
      >
        {!hasContent ? (
          <div className={styles["test-result-strut"]} />
        ) : (
          <ArrowButton
            isOpened={isOpened}
            icon={allureIcons.arrowsChevronDown}
            iconSize={"xs"}
            className={!hasContent ? styles["test-result-visibility-hidden"] : ""}
          />
        )}
        <TreeItemIcon status={item.status} />
        <Code size={"s"} className={styles["test-result-step-number"]}>
          {stepIndex}
        </Code>
        <LinkifiedText className={styles["test-result-header-text"]} text={item.name} />
        <TestResultStepInfo item={item} />
      </div>
      {hasContent && isOpened && <TestResultStepsContent item={item} />}
    </div>
  );
};
