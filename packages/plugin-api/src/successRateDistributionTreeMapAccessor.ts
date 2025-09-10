import type { TreeMapDataAccessor } from "./charts.js";
import type { TreeMapNode } from "@allurereport/core-api";
import { createBehaviorTreeMap, filterTestsWithBehaviorLabels } from "./behaviorTreeMap.js";

export const successRateDistributionTreeMapAccessor: TreeMapDataAccessor<TreeMapNode> = {
  getTreeMap: ({ testResults }) => {
    const testsWithBehaviorLabels = filterTestsWithBehaviorLabels(testResults);

    return createBehaviorTreeMap(testsWithBehaviorLabels);
  },
};
