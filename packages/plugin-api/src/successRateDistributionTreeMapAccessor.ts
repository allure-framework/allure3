import type { TreeMapDataAccessor } from "./charts.js";
import type { TestResult, TreeMapNode } from "@allurereport/core-api";

const behaviourLabels = ["epic", "feature", "story"] as const;

type BehaviourLabel = typeof behaviourLabels[number];


export const successRateDistributionTreeMapAccessor: TreeMapDataAccessor<TreeMapNode> = {
  getTreeMap: (storeData) => {
    const { testResults } = storeData;

    const tree = testResults.reduce((acc, test) => {
      const { status } = test;
      
      return acc;
    }, { id: "successRateDistribution", children: [] });

    return tree;
  },
};
