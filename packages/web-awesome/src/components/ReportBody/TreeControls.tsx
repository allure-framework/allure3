import { IconButton, allureIcons } from "@allurereport/web-components";
import { useComputed } from "@preact/signals";

import { useI18n } from "@/stores/locale";
import { collapseAllTrees, collapsedTrees, expandAllTrees, filteredTree } from "@/stores/tree";

import * as styles from "./styles.scss";

/**
 * Check if all nodes in the filtered tree are collapsed
 */
const areAllNodesCollapsed = () => {
  const trees = Object.values(filteredTree.value);
  if (trees.length === 0) {
    return false;
  }

  const collectNodeIds = (tree: any): string[] => {
    const ids: string[] = [];
    if (tree.nodeId) {
      ids.push(tree.nodeId);
    }
    for (const subtree of tree.trees) {
      ids.push(...collectNodeIds(subtree));
    }
    return ids;
  };

  const allNodeIds = trees.flatMap(collectNodeIds);
  if (allNodeIds.length === 0) {
    return false;
  }

  // If most nodes are in collapsedTrees, consider the tree collapsed
  const collapsedCount = allNodeIds.filter((id) => collapsedTrees.value.has(id)).length;
  return collapsedCount > allNodeIds.length / 2;
};

export const TreeControls = () => {
  const { t } = useI18n("controls");
  
  // Compute whether the tree is currently in a collapsed state
  const isCollapsed = useComputed(() => areAllNodesCollapsed());

  const handleToggle = () => {
    if (isCollapsed.value) {
      expandAllTrees();
    } else {
      collapseAllTrees();
    }
  };

  return (
    <div className={styles.treeControls}>
      <IconButton
        size="s"
        style="ghost"
        icon={isCollapsed.value ? allureIcons.lineArrowsChevronDown : allureIcons.lineArrowsChevronUp}
        onClick={handleToggle}
        aria-label={isCollapsed.value ? t("expandAllTree") : t("collapseAllTree")}
        dataTestId="tree-toggle-all"
      />
    </div>
  );
};
