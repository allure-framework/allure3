import type { TreeMapNode, TreeData, TreeLeaf, TreeGroup } from "@allurereport/core-api";
import { TreeMapChartType } from "@allurereport/core-api";
import type { AllureChartsStoreData, TreeMapChartOptions, TreeMapDataAccessor, TreeMapChartData } from "../charts.js";
import { successRateDistributionTreeMapAccessor } from "./accessors/successRateDistributionTreeMapAccessor.js";

/**
 * Convert TreeData structure to TreeMapNode structure
 * Generic function that works with any TreeData<L, G> and converts it to TreeMapNode
 */
export const convertTreeDataToTreeMapNode = <L, G>(
    treeData: TreeData<L, G>,
    transform: (treeDataNode: TreeLeaf<L> | TreeGroup<G>, isGroup: boolean) => TreeMapNode,
): TreeMapNode => {
    const { root, leavesById, groupsById } = treeData;

    const convertNode = (nodeId: string, isGroup: boolean): TreeMapNode | null => {
        const node = isGroup ? groupsById[nodeId] : leavesById[nodeId];
        if (!node) {
            return null;
        }

        const treeMapNode: TreeMapNode = transform(node, isGroup);

        // Add children if it's a group
        if (isGroup) {
            const group = node as TreeGroup<G>;
            const children: TreeMapNode[] = [];

            // Add child groups
            if (group.groups) {
                group.groups.forEach((groupId) => {
                    const childNode = convertNode(groupId, true);
                    if (childNode) {
                        children.push(childNode);
                    }
                });
            }

            // Add child leaves
            if (group.leaves) {
                group.leaves.forEach((leafId) => {
                    const childNode = convertNode(leafId, false);
                    if (childNode) {
                        children.push(childNode);
                    }
                });
            }

            if (children.length === 0) {
                return null;
            }

            treeMapNode.children = children;
        }

        return treeMapNode;
    };

    // Start from root and convert all groups
    const rootChildren: TreeMapNode[] = [];

    if (root.groups) {
        root.groups.forEach(groupId => {
            const childNode = convertNode(groupId, true);
            if (childNode) {
                rootChildren.push(childNode);
            }
        });
    }

    if (root.leaves) {
        root.leaves.forEach(leafId => {
            const childNode = convertNode(leafId, false);
            if (childNode) {
                rootChildren.push(childNode);
            }
        });
    }

    return {
        id: "root",
        value: undefined,
        children: rootChildren.length > 0 ? rootChildren : undefined,
    };
};

export const transformTreeMapNode = <T extends TreeMapNode>(tree: T, transform: (node: T) => void) => {
    transform(tree);

    if (tree.children) {
        tree.children.forEach(child => {
            transformTreeMapNode(child as T, transform);
        });
    }
};

export const generateTreeMapChartGeneric = <T extends TreeMapNode>(
    options: TreeMapChartOptions,
    storeData: AllureChartsStoreData,
    dataAccessor: TreeMapDataAccessor<T>,
): TreeMapChartData | undefined => ({
    type: options.type,
    dataType: options.dataType,
    title: options.title,
    treeMap: dataAccessor.getTreeMap(storeData),
});

export const generateTreeMapChart = (
    options: TreeMapChartOptions,
    storeData: AllureChartsStoreData,
): TreeMapChartData | undefined => {
    const { dataType } = options;

    if (dataType === TreeMapChartType.SuccessRateDistribution) {
      return generateTreeMapChartGeneric(options, storeData, successRateDistributionTreeMapAccessor);
    }
};
