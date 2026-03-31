import type { FunctionComponent } from "preact";

import { MetadataList } from "@/components/Metadata";
import { type MetadataItem } from "@/components/ReportMetadata";
import type { TrStepItem } from "@/components/TestResult/bodyItems";
import { TrError } from "@/components/TestResult/TrError";
import { TrBodyItems } from "@/components/TestResult/TrSteps/TrBodyItems";
import { TrStepHeader } from "@/components/TestResult/TrSteps/TrStepHeader";
import { TrStepInfo } from "@/components/TestResult/TrSteps/TrStepInfo";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

export const TrStepParameters = (props: { parameters: TrStepItem["item"]["parameters"] }) => {
  const { parameters } = props;

  return (
    <div className={styles["test-result-parameters"]}>
      <MetadataList size={"s"} envInfo={parameters as unknown as MetadataItem[]} columns={1} />
    </div>
  );
};

export const TrStepsContent = (props: { item: TrStepItem }) => {
  const { item: stepData, bodyItems, suppressInlineError } = props.item;
  const hasInlineError = Boolean(
    (stepData.message || stepData.trace) && !stepData.hasSimilarErrorInSubSteps && !suppressInlineError,
  );

  return (
    <div data-testid={"test-result-step-content"} className={styles["test-result-step-content"]}>
      {Boolean(stepData.parameters?.length) && <TrStepParameters parameters={stepData.parameters} />}
      {hasInlineError && <TrError {...stepData} />}
      {Boolean(bodyItems.length) && <TrBodyItems bodyItems={bodyItems} />}
    </div>
  );
};

export const TrStep: FunctionComponent<{
  item: TrStepItem;
  stepIndex?: number;
}> = ({ item, stepIndex }) => {
  const { item: stepData, bodyItems, suppressInlineError } = item;
  const hasInlineError = Boolean(
    (stepData.message || stepData.trace) && !stepData.hasSimilarErrorInSubSteps && !suppressInlineError,
  );
  const hasContent = Boolean(bodyItems.length || stepData.parameters?.length || hasInlineError);
  const isOpened = !collapsedTrees.value.has(stepData.stepId);

  return (
    <div data-testid={"test-result-step"} className={styles["test-result-step"]}>
      <TrStepHeader
        title={stepData.name}
        status={stepData.status}
        stepIndex={stepIndex}
        isOpened={isOpened}
        hasContent={hasContent}
        onToggle={() => toggleTree(stepData.stepId)}
        extra={<TrStepInfo item={stepData} />}
      />
      {hasContent && isOpened && <TrStepsContent item={item} />}
    </div>
  );
};
