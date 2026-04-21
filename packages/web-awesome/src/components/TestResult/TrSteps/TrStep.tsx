import { IconButton, allureIcons } from "@allurereport/web-components";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { MetadataList } from "@/components/Metadata";
import { type MetadataItem } from "@/components/ReportMetadata";
import { hasErrorDiff, type TrStepItem } from "@/components/TestResult/bodyItems";
import { TrError } from "@/components/TestResult/TrError";
import {
  collectExpandableStepNodes,
  hasStepContent,
  getStepTreeExpansionPolicy,
  getNextSubtreeToggleState,
  getSubtreeToggleIcon,
  isSubtreeFirstLevelOnlyOpened,
  isStepOpenedByDefault,
  type SubtreeNode,
  type SubtreeToggleState,
} from "@/components/TestResult/TrSteps/stepTreeExpansion";
import { TrBodyItems } from "@/components/TestResult/TrSteps/TrBodyItems";
import { TrStepHeader } from "@/components/TestResult/TrSteps/TrStepHeader";
import { TrStepInfo } from "@/components/TestResult/TrSteps/TrStepInfo";
import { isTreeOpened, setTreeOpened, toggleTree } from "@/stores/tree";

import * as styles from "@/components/TestResult/TrSteps/styles.scss";

const iconBySubtreeState = {
  "single-down": allureIcons.lineArrowsChevronDown,
  "single-up": allureIcons.lineArrowsChevronUp,
  "double-down": allureIcons.lineArrowsChevronDownDouble,
  "double-up": allureIcons.lineArrowsChevronUpDouble,
} as const;

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
  const inlineError = {
    message: stepData.message ?? stepData.error?.message,
    trace: stepData.trace ?? stepData.error?.trace,
    actual: stepData.error?.actual,
    expected: stepData.error?.expected,
  };
  const hasInlineError = Boolean(
    (inlineError.message || inlineError.trace || hasErrorDiff(inlineError)) &&
    !stepData.hasSimilarErrorInSubSteps &&
    !suppressInlineError,
  );

  return (
    <div data-testid={"test-result-step-content"} className={styles["test-result-step-content"]}>
      {Boolean(stepData.parameters?.length) && <TrStepParameters parameters={stepData.parameters} />}
      {hasInlineError && <TrError {...inlineError} status={stepData.status} />}
      {Boolean(bodyItems.length) && <TrBodyItems bodyItems={bodyItems} />}
    </div>
  );
};

export const TrStep: FunctionComponent<{
  item: TrStepItem;
  stepIndex?: number;
}> = ({ item, stepIndex }) => {
  const { item: stepData, bodyItems, suppressInlineError } = item;
  const inlineError = {
    message: stepData.message ?? stepData.error?.message,
    trace: stepData.trace ?? stepData.error?.trace,
    actual: stepData.error?.actual,
    expected: stepData.error?.expected,
  };
  const hasInlineError = Boolean(
    (inlineError.message || inlineError.trace || hasErrorDiff(inlineError)) &&
    !stepData.hasSimilarErrorInSubSteps &&
    !suppressInlineError,
  );
  const policy = getStepTreeExpansionPolicy();
  const hasContent = hasStepContent(item);
  const openedByDefault = isStepOpenedByDefault(policy, stepData.status, bodyItems);
  const isOpened = isTreeOpened(stepData.stepId, openedByDefault);
  const expandableDescendantNodes = collectExpandableStepNodes(bodyItems, policy);
  const hasExpandableDescendants = expandableDescendantNodes.length > 0;
  const subtreeNodes: SubtreeNode[] = hasExpandableDescendants
    ? [
        { id: stepData.stepId, openedByDefault, isRoot: true },
        ...expandableDescendantNodes.map((node) => ({ ...node, isRoot: false })),
      ]
    : [];
  const [lastSubtreeToggle, setLastSubtreeToggle] = useState<SubtreeToggleState | null>(null);
  const isRootSubtreeOpened = isTreeOpened(stepData.stepId, openedByDefault);
  const isSubtreeCollapsedAll = !isRootSubtreeOpened;
  const isSubtreeFirstLevelOnly = isSubtreeFirstLevelOnlyOpened(
    stepData.stepId,
    openedByDefault,
    subtreeNodes,
    isTreeOpened,
  );
  const isSubtreeExpandedAll =
    hasExpandableDescendants && subtreeNodes.every((node) => isTreeOpened(node.id, node.openedByDefault));
  const hasOnlyLeafResults = hasExpandableDescendants && subtreeNodes.every((node) => node.isRoot);
  const subtreeToggleIcon =
    iconBySubtreeState[
      getSubtreeToggleIcon({
        hasOnlyLeafResults,
        isSubtreeCollapsedAll,
        isSubtreeFirstLevelOnly,
      })
    ];

  const setSubtreeState = (state: SubtreeToggleState) => {
    subtreeNodes.forEach((node) => {
      const shouldOpenSubtree = state === "all" ? true : state === "first" ? node.isRoot : false;
      setTreeOpened(node.id, shouldOpenSubtree, node.openedByDefault);
    });
  };

  const toggleSubtree = (event: MouseEvent) => {
    event.stopPropagation();
    const nextState = getNextSubtreeToggleState({
      hasOnlyLeafResults,
      isSubtreeCollapsedAll,
      isSubtreeFirstLevelOnly,
      isSubtreeExpandedAll,
      lastSubtreeToggle,
    });
    setSubtreeState(nextState);
    if (nextState !== "first") {
      setLastSubtreeToggle(nextState);
    }
  };

  const toggleStep = () => {
    setLastSubtreeToggle(null);
    toggleTree(stepData.stepId, openedByDefault);
  };

  return (
    <div data-testid={"test-result-step"} className={styles["test-result-step"]}>
      <TrStepHeader
        title={stepData.name}
        status={stepData.status}
        stepIndex={stepIndex}
        isOpened={isOpened}
        hasContent={hasContent}
        onToggle={toggleStep}
        subtreeToggle={
          hasExpandableDescendants ? (
            <IconButton
              style="ghost"
              size="xs"
              icon={subtreeToggleIcon}
              onClick={toggleSubtree}
              data-testid="test-result-step-subtree-toggle"
              className={styles["test-result-step-subtree-toggle"]}
            />
          ) : null
        }
        extra={<TrStepInfo item={stepData} />}
      />
      {hasContent && isOpened && <TrStepsContent item={item} />}
    </div>
  );
};
