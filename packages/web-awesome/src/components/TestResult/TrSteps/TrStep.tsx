import {
  getNextSubtreeToggleState,
  getSubtreeToggleAction,
  getSubtreeToggleIcon,
  hasErrorDiff,
  isSubtreeFirstLevelOnlyOpened,
  type SubtreeToggleState,
} from "@allurereport/web-commons";
import { allureIcons } from "@allurereport/web-components/core";
import type { FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { MetadataList } from "@/components/Metadata";
import { type MetadataItem } from "@/components/ReportMetadata";
import { type TrStepItem } from "@/components/TestResult/bodyItems";
import { TrError } from "@/components/TestResult/TrError";
import {
  collectExpandableStepNodes,
  hasStepContent,
  getStepTreeExpansionPolicy,
  isStepOpenedByDefault,
  type SubtreeNode,
} from "@/components/TestResult/TrSteps/stepTreeExpansion";
import { SubtreeToggleButton } from "@/components/TestResult/TrSteps/SubtreeToggleButton";
import { TrBodyItems } from "@/components/TestResult/TrSteps/TrBodyItems";
import { TrStepHeader } from "@/components/TestResult/TrSteps/TrStepHeader";
import { TrStepInfo } from "@/components/TestResult/TrSteps/TrStepInfo";
import { isTreeOpened, setTreeOpened, toggleTree } from "@/stores/tree";
import { trOverviewFocusAttrs, trOverviewHeaderFocusClass } from "@/utils/trOverviewFocus";

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
  const hasInlineError = !!(
    (inlineError.message || inlineError.trace || hasErrorDiff(inlineError)) &&
    !stepData.hasSimilarErrorInSubSteps &&
    !suppressInlineError
  );

  return (
    <div data-testid={"test-result-step-content"} className={styles["test-result-step-content"]}>
      {!!stepData.parameters?.length && <TrStepParameters parameters={stepData.parameters} />}
      {hasInlineError && <TrError {...inlineError} status={stepData.status} />}
      {!!bodyItems.length && <TrBodyItems bodyItems={bodyItems} />}
    </div>
  );
};

export const TrStep: FunctionComponent<{
  item: TrStepItem;
  stepIndex?: number;
}> = ({ item, stepIndex }) => {
  const { item: stepData, bodyItems } = item;
  // Core assigns stepId when converting raw steps.
  const stepId = stepData.stepId!;
  const policy = getStepTreeExpansionPolicy();
  const hasContent = hasStepContent(item);
  const openedByDefault = isStepOpenedByDefault(policy, stepData.status, bodyItems);
  const isOpened = isTreeOpened(stepId, openedByDefault);
  const expandableDescendantNodes = collectExpandableStepNodes(bodyItems, policy);
  const hasExpandableDescendants = expandableDescendantNodes.length > 0;
  const subtreeNodes: SubtreeNode[] = hasExpandableDescendants
    ? [
        { id: stepId, openedByDefault, isRoot: true },
        ...expandableDescendantNodes.map((node) => ({ ...node, isRoot: false })),
      ]
    : [];
  const [lastSubtreeToggle, setLastSubtreeToggle] = useState<SubtreeToggleState | null>(null);
  const isRootSubtreeOpened = isTreeOpened(stepId, openedByDefault);
  const isSubtreeCollapsedAll = !isRootSubtreeOpened;
  const isSubtreeFirstLevelOnly = isSubtreeFirstLevelOnlyOpened(stepId, openedByDefault, subtreeNodes, isTreeOpened);
  const isSubtreeExpandedAll =
    hasExpandableDescendants && subtreeNodes.every((node) => isTreeOpened(node.id, node.openedByDefault));
  const hasOnlyLeafResults = hasExpandableDescendants && subtreeNodes.every((node) => node.isRoot);

  const setSubtreeState = (state: SubtreeToggleState) => {
    subtreeNodes.forEach((node) => {
      const shouldOpenSubtree = state === "all" ? true : state === "first" ? node.isRoot : false;
      setTreeOpened(node.id, shouldOpenSubtree, node.openedByDefault);
    });
  };

  const subtreeToggleState = {
    hasOnlyLeafResults,
    isSubtreeCollapsedAll,
    isSubtreeFirstLevelOnly,
    isSubtreeExpandedAll,
    lastSubtreeToggle,
  };

  const subtreeToggleIcon = iconBySubtreeState[getSubtreeToggleIcon(subtreeToggleState)];

  const toggleSubtree = (event: MouseEvent) => {
    event.stopPropagation();
    const nextState = getNextSubtreeToggleState(subtreeToggleState);
    setSubtreeState(nextState);
    if (nextState !== "first") {
      setLastSubtreeToggle(nextState);
    }
  };

  const toggleStep = () => {
    setLastSubtreeToggle(null);
    toggleTree(stepId, openedByDefault);
  };

  return (
    <div data-testid={"test-result-step"} className={styles["test-result-step"]}>
      <TrStepHeader
        className={trOverviewHeaderFocusClass(stepId)}
        {...trOverviewFocusAttrs(stepId)}
        title={stepData.name}
        status={stepData.status}
        stepIndex={stepIndex}
        isOpened={isOpened}
        hasContent={hasContent}
        onToggle={toggleStep}
        subtreeToggle={
          hasExpandableDescendants ? (
            <SubtreeToggleButton
              action={getSubtreeToggleAction(subtreeToggleState)}
              icon={subtreeToggleIcon}
              onClick={toggleSubtree}
              data-testid="test-result-step-subtree-toggle"
              className={styles["test-result-step-subtree-toggle"]}
              wrapperClassName={styles["test-result-step-subtree-toggle-wrapper"]}
            />
          ) : null
        }
        extra={<TrStepInfo item={stepData} />}
      />
      {hasContent && isOpened && <TrStepsContent item={item} />}
    </div>
  );
};
