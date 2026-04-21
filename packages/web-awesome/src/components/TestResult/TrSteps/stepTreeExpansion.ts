import type { TestStatus } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import {
  getNextSubtreeToggleState,
  getSubtreeToggleIcon,
  isSubtreeFirstLevelOnlyOpened,
  type SubtreeNodeState,
  type SubtreeToggleState,
} from "@allurereport/web-commons";

import { hasTestLevelErrorContent, type TrBodyItem, type TrStepItem } from "@/components/TestResult/bodyItems";

import type { AwesomeReportOptions, StepTreeExpansion } from "../../../../types";

const DEFAULT_STEP_TREE_EXPANSION_POLICY: StepTreeExpansion = "expand_failed_only";

const isFailedStatus = (status: TestStatus) => status === "failed" || status === "broken";

export const hasFailedStepContext = (bodyItems: TrBodyItem[]): boolean =>
  bodyItems.some((bodyItem) => {
    if (bodyItem.type === "step") {
      return isFailedStatus(bodyItem.item.status) || hasFailedStepContext(bodyItem.bodyItems);
    }

    if (bodyItem.type === "error") {
      return isFailedStatus(bodyItem.status);
    }

    return false;
  });

const hasInlineStepError = (stepItem: TrStepItem) => {
  const { item: stepData, suppressInlineError } = stepItem;
  return Boolean((stepData.message || stepData.trace) && !stepData.hasSimilarErrorInSubSteps && !suppressInlineError);
};

export const hasStepContent = (stepItem: TrStepItem): boolean => {
  return Boolean(stepItem.bodyItems.length || stepItem.item.parameters?.length || hasInlineStepError(stepItem));
};

export const isStepOpenedByDefault = (
  policy: StepTreeExpansion,
  status: TestStatus,
  bodyItems: TrBodyItem[],
): boolean => {
  const hasFailedContext = status === "failed" || status === "broken" || hasFailedStepContext(bodyItems);
  return isOpenByDefaultForPolicy(policy, hasFailedContext);
};

export type ExpandableStepNode = {
  id: string;
  openedByDefault: boolean;
};

export type SubtreeNode = SubtreeNodeState;

export const collectExpandableStepNodes = (
  bodyItems: TrBodyItem[],
  policy: StepTreeExpansion,
): ExpandableStepNode[] => {
  const nodes: ExpandableStepNode[] = [];

  bodyItems.forEach((bodyItem) => {
    if (bodyItem.type === "step") {
      if (hasStepContent(bodyItem)) {
        nodes.push({
          id: bodyItem.item.stepId,
          openedByDefault: isStepOpenedByDefault(policy, bodyItem.item.status, bodyItem.bodyItems),
        });
      }
      nodes.push(...collectExpandableStepNodes(bodyItem.bodyItems, policy));
      return;
    }

    if (bodyItem.type === "error" && hasTestLevelErrorContent(bodyItem.error)) {
      nodes.push({
        id: bodyItem.id,
        openedByDefault: isOpenByDefaultForPolicy(policy, bodyItem.status === "failed" || bodyItem.status === "broken"),
      });
    }
  });

  return nodes;
};

export { getNextSubtreeToggleState, getSubtreeToggleIcon, isSubtreeFirstLevelOnlyOpened, type SubtreeToggleState };

export const getStepTreeExpansionPolicy = (): StepTreeExpansion =>
  getReportOptions<AwesomeReportOptions>()?.stepTreeExpansion ?? DEFAULT_STEP_TREE_EXPANSION_POLICY;

export const isOpenByDefaultForPolicy = (policy: StepTreeExpansion, hasFailedContext: boolean): boolean => {
  if (policy === "expanded") {
    return true;
  }

  if (policy === "collapsed") {
    return false;
  }

  return hasFailedContext;
};
