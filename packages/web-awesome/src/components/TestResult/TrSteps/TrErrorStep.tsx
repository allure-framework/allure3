import clsx from "clsx";
import type { FunctionComponent } from "preact";

import { hasTestLevelErrorContent, type TestLevelErrorItem } from "@/components/TestResult/bodyItems";
import { TrError } from "@/components/TestResult/TrError";
import { TrStepHeader } from "@/components/TestResult/TrSteps/TrStepHeader";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

export type TrErrorStepProps = {
  item: TestLevelErrorItem;
  stepIndex?: number;
};

export const TrErrorStep: FunctionComponent<TrErrorStepProps> = ({ item, stepIndex }) => {
  const isOpened = !collapsedTrees.value.has(item.id);
  const hasContent = hasTestLevelErrorContent(item.error);

  return (
    <div data-testid="test-result-step" className={styles["test-result-step"]}>
      <TrStepHeader
        title={item.title}
        status={item.status}
        stepIndex={stepIndex}
        isOpened={isOpened}
        hasContent={hasContent}
        onToggle={() => toggleTree(item.id)}
      />
      {isOpened && hasContent && (
        <div
          data-testid="test-result-step-content"
          className={clsx(styles["test-result-step-content"], styles["test-result-error-step-content"])}
        >
          <TrError {...item.error} status={item.status} showMessage={false} />
        </div>
      )}
    </div>
  );
};
