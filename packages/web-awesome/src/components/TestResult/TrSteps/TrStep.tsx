import type { DefaultTestStepResult } from "@allurereport/core-api";
import { ArrowButton, Code, Text, TreeItemIcon, allureIcons } from "@allurereport/web-components";
import type { FunctionComponent } from "preact";

import { MetadataList } from "@/components/Metadata";
import { type MetadataItem } from "@/components/ReportMetadata";
import { TrError } from "@/components/TestResult/TrError";
import { TrAttachment } from "@/components/TestResult/TrSteps/TrAttachment";
import { TrStepInfo } from "@/components/TestResult/TrSteps/TrStepInfo";
import { collapsedTrees, toggleTree } from "@/stores/tree";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

export const TrStepParameters = (props: { parameters: DefaultTestStepResult["parameters"] }) => {
  const { parameters } = props;

  return (
    <div className={styles["test-result-parameters"]}>
      <MetadataList size={"s"} envInfo={parameters as unknown as MetadataItem[]} columns={1} />
    </div>
  );
};

export const TrStepsContent = (props: { item: DefaultTestStepResult }) => {
  const { item } = props;

  return (
    <div data-testid={"test-result-step-content"} className={styles["test-result-step-content"]}>
      {Boolean(item?.parameters?.length) && <TrStepParameters parameters={item.parameters} />}
      {Boolean((item?.message || item?.trace) && !item?.hasSimilarErrorInSubSteps) && <TrError {...item} />}
      {Boolean(item?.steps?.length) && (
        <>
          {item.steps?.map((subItem, key) => {
            if (subItem.type === "step") {
              return <TrStep stepIndex={key + 1} key={key} item={subItem} />;
            }

            if (subItem.type === "attachment") {
              return <TrAttachment stepIndex={key + 1} key={key} item={subItem} />;
            }

            return null;
          })}
        </>
      )}
    </div>
  );
};

export const TrStep: FunctionComponent<{
  item: DefaultTestStepResult;
  stepIndex?: number;
  className?: string;
}> = ({ item, stepIndex }) => {
  const hasContent = Boolean(item?.steps?.length || item?.parameters?.length || item?.message || item?.trace);
  const isOpened = !collapsedTrees.value.has(item.stepId);

  const handleClick = () => {
    toggleTree(item.stepId);
  };

  return (
    <div data-testid={"test-result-step"} className={styles["test-result-step"]}>
      <div data-testid={"test-result-step-header"} className={styles["test-result-step-header"]} onClick={handleClick}>
        {!hasContent ? (
          <div className={styles["test-result-strut"]} />
        ) : (
          <ArrowButton
            isOpened={isOpened}
            icon={allureIcons.arrowsChevronDown}
            iconSize={"xs"}
            className={!hasContent ? styles["test-result-visibility-hidden"] : ""}
            data-testid={"test-result-step-arrow-button"}
          />
        )}
        <TreeItemIcon status={item.status} />
        <Code size={"s"} className={styles["test-result-step-number"]}>
          {stepIndex}
        </Code>
        <Text data-testid={"test-result-step-title"} className={styles["test-result-header-text"]}>
          {item.name}
        </Text>
        <TrStepInfo item={item} />
      </div>
      {hasContent && isOpened && <TrStepsContent item={item} />}
    </div>
  );
};
