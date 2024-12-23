import type { DefaultTestStepResult } from "@allurereport/core-api";
import { Code, Text } from "@allurereport/web-components";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import arrowsChevronDown from "@/assets/svg/arrows-chevron-down.svg";
import { ArrowButton } from "@/components/ArrowButton";
import { MetadataList } from "@/components/Metadata";
import * as styles from "@/components/TestResult/TestResultSteps/styles.scss";
import { TestResultAttachment } from "@/components/TestResult/TestResultSteps/testResultAttachment";
import { TestResultStepInfo } from "@/components/TestResult/TestResultSteps/testResultStepInfo";
import TreeItemIcon from "@/components/Tree/TreeItemIcon";

export const TestResultStepParameters = ({ parameters }) => {
  return (
    <div className={styles["test-result-parameters"]}>
      <MetadataList size={"s"} envInfo={parameters} columns={1} />
    </div>
  );
};
export const TestResultStepsContent = ({ item }) => {
  const typeMap = {
    step: TestResultStep,
    attachment: TestResultAttachment,
  };
  return (
    <div className={styles["test-result-step-content"]}>
      {Boolean(item?.parameters?.length) && <TestResultStepParameters parameters={item.parameters} />}
      {Boolean(item?.steps?.length) && (
        <>
          {item.steps?.map((subItem, key) => {
            const StepComponent = typeMap[subItem.type];
            return <StepComponent stepIndex={key + 1} key={key} item={subItem} />;
          })}
        </>
      )}
    </div>
  );
};

export const TestResultStep: FunctionComponent<{
  item: DefaultTestStepResult;
  stepIndex?: number;
  className?: string;
}> = ({ item, stepIndex }) => {
  const [isOpened, setIsOpen] = useState(false);
  const hasContent = Boolean(item?.steps?.length || item?.parameters?.length);

  return (
    <div className={styles["test-result-step"]}>
      <div className={styles["test-result-step-header"]} onClick={() => setIsOpen(!isOpened)}>
        {!hasContent ? (
          <div className={styles["test-result-strut"]} />
        ) : (
          <ArrowButton
            isOpened={isOpened}
            icon={arrowsChevronDown.id}
            iconSize={"xs"}
            className={!hasContent ? styles["test-result-visibility-hidden"] : ""}
          />
        )}
        <TreeItemIcon status={item.status} />
        <Code size={"s"} className={styles["test-result-step-number"]}>
          {stepIndex}
        </Code>
        <Text className={styles["test-result-header-text"]}>{item.name}</Text>
        <TestResultStepInfo item={item} />
      </div>
      {hasContent && isOpened && <TestResultStepsContent item={item} />}
    </div>
  );
};
