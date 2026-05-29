import type { FlatTreeNode } from "@allurereport/web-commons";

import type { TrBodyItem } from "@/components/TestResult/bodyItems";
import { hasTestLevelErrorContent } from "@/components/TestResult/bodyItems";
import {
  getStepTreeExpansionPolicy,
  hasStepContent,
  isStepOpenedByDefault,
  type StepTreeExpansion,
} from "@/components/TestResult/TrSteps/stepTreeExpansion";

export type FlattenTestResultOverviewInput = {
  testResultId: string;
  hasSetup: boolean;
  setupBodyItems: TrBodyItem[];
  bodyItems: TrBodyItem[];
  hasTeardown: boolean;
  teardownBodyItems: TrBodyItem[];
  isGroupOpened: (id: string, openedByDefault: boolean) => boolean;
  stepExpansionPolicy?: StepTreeExpansion;
};

const sectionId = (testResultId: string, section: string) => `${testResultId}-${section}`;

const pushSection = (
  result: FlatTreeNode[],
  options: {
    id: string;
    depth: number;
    parentId?: string;
    openedByDefault?: boolean;
    isGroupOpened: FlattenTestResultOverviewInput["isGroupOpened"];
  },
) => {
  const openedByDefault = options.openedByDefault ?? true;
  const isExpanded = options.isGroupOpened(options.id, openedByDefault);

  result.push({
    kind: "group",
    id: options.id,
    nodeId: options.id,
    depth: options.depth,
    parentId: options.parentId,
    hasChildren: true,
    isExpanded,
    openedByDefault,
  });
};

const flattenBodyItems = (
  bodyItems: TrBodyItem[],
  depth: number,
  parentId: string,
  policy: StepTreeExpansion,
  isGroupOpened: FlattenTestResultOverviewInput["isGroupOpened"],
): FlatTreeNode[] => {
  const result: FlatTreeNode[] = [];

  for (const bodyItem of bodyItems) {
    if (bodyItem.type === "step") {
      const stepId = bodyItem.item.stepId;
      const openedByDefault = isStepOpenedByDefault(policy, bodyItem.item.status, bodyItem.bodyItems);
      const hasContent = hasStepContent(bodyItem);
      const isExpanded = isGroupOpened(stepId, openedByDefault);

      result.push({
        kind: hasContent ? "group" : "leaf",
        id: stepId,
        nodeId: stepId,
        depth,
        parentId,
        hasChildren: hasContent,
        isExpanded: hasContent ? isExpanded : undefined,
        openedByDefault,
      });

      if (hasContent && isExpanded) {
        result.push(...flattenBodyItems(bodyItem.bodyItems, depth + 1, stepId, policy, isGroupOpened));
      }

      continue;
    }

    if (bodyItem.type === "error" && hasTestLevelErrorContent(bodyItem.error)) {
      const openedByDefault = policy !== "collapsed";
      const isExpanded = isGroupOpened(bodyItem.id, openedByDefault);

      result.push({
        kind: "group",
        id: bodyItem.id,
        nodeId: bodyItem.id,
        depth,
        parentId,
        hasChildren: true,
        isExpanded,
        openedByDefault,
      });
      continue;
    }

    if (bodyItem.type === "attachment") {
      const attachmentTreeId = `attachment-${bodyItem.link.id}`;

      result.push({
        kind: "leaf",
        id: bodyItem.link.id,
        nodeId: attachmentTreeId,
        depth,
        parentId,
        openedByDefault: false,
      });
    }
  }

  return result;
};

export const flattenTestResultOverview = (input: FlattenTestResultOverviewInput): FlatTreeNode[] => {
  const { testResultId, hasSetup, setupBodyItems, bodyItems, hasTeardown, teardownBodyItems, isGroupOpened } = input;
  const policy = input.stepExpansionPolicy ?? getStepTreeExpansionPolicy();
  const result: FlatTreeNode[] = [];
  let lastSectionId: string | undefined;

  const appendSection = (section: string, openedByDefault = true) => {
    const id = sectionId(testResultId, section);
    pushSection(result, {
      id,
      depth: 0,
      parentId: lastSectionId,
      openedByDefault,
      isGroupOpened,
    });
    lastSectionId = id;
    return id;
  };

  if (hasSetup) {
    const setupId = appendSection("setup");

    if (isGroupOpened(setupId, true) && setupBodyItems.length > 0) {
      const setupSteps = flattenBodyItems(setupBodyItems, 1, setupId, policy, isGroupOpened);
      result.push(...setupSteps);

      if (setupSteps.length > 0) {
        lastSectionId = setupSteps[setupSteps.length - 1]!.id;
      }
    }
  }

  if (bodyItems.length > 0) {
    const stepsId = sectionId(testResultId, "steps");
    const stepsOpenedByDefault = policy !== "collapsed";
    const stepsExpanded = isGroupOpened(stepsId, stepsOpenedByDefault);

    pushSection(result, {
      id: stepsId,
      depth: 0,
      parentId: lastSectionId,
      openedByDefault: stepsOpenedByDefault,
      isGroupOpened,
    });
    lastSectionId = stepsId;

    if (stepsExpanded) {
      const stepNodes = flattenBodyItems(bodyItems, 1, stepsId, policy, isGroupOpened);
      result.push(...stepNodes);
      if (stepNodes.length > 0) {
        lastSectionId = stepNodes[stepNodes.length - 1]!.id;
      }
    }
  }

  if (hasTeardown) {
    const teardownId = appendSection("teardown");

    if (isGroupOpened(teardownId, true) && teardownBodyItems.length > 0) {
      result.push(...flattenBodyItems(teardownBodyItems, 1, teardownId, policy, isGroupOpened));
    }
  }

  return result;
};
