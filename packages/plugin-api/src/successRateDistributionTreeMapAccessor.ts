import type { TreeMapDataAccessor } from "./charts.js";
import type { TreeMapNode } from "@allurereport/core-api";
import { createBehaviorTreeMap, filterTestsWithBehaviorLabels } from "./behaviorTreeMap.js";

export const successRateDistributionTreeMapAccessor: TreeMapDataAccessor<TreeMapNode> = {
  getTreeMap: (storeData) => {
    const { testResults } = storeData;

    // Filter tests that have behavior labels (epic, feature, story)
    const testsWithBehaviorLabels = filterTestsWithBehaviorLabels(testResults);

    // Create TreeMap using the new abstract system
    const treeMap = createBehaviorTreeMap(testsWithBehaviorLabels);

    console.log("##### treeMap #####", treeMap);

    return treeMap;
  },
};
