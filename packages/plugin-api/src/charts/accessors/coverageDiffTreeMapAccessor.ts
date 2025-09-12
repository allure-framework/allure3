import type { TreeMapDataAccessor } from "../../charts.js";
import type { TreeMapNode, TestResult } from "@allurereport/core-api";
import { createBehaviorTreeMap, filterTestsWithBehaviorLabels } from "./utils/behaviorTreeMap.js";

const createCoverageDiffTreeMap = (testResults: TestResult[]): TreeMapNode => {
  return createBehaviorTreeMap(testResults);
};

export const coverageDiffTreeMapAccessor: TreeMapDataAccessor<TreeMapNode> = {
  getTreeMap: ({ testResults }) => {
    const testsWithBehaviorLabels = filterTestsWithBehaviorLabels(testResults);

    return createCoverageDiffTreeMap(testsWithBehaviorLabels);
  },
};
