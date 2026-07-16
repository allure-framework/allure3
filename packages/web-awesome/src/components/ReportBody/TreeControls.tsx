import { IconButton, allureIcons } from "@allurereport/web-components";
import { memo } from "preact/compat";
import { useCallback, useMemo } from "preact/hooks";

import { currentEnvironment } from "@/stores/env";
import { collapseAllTreeNodes, expandAllTreeNodes, getTreeFocusIdPrefix } from "@/stores/keyboardActions";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, filteredTree } from "@/stores/tree";

import * as styles from "./styles.scss";

/**
 * Check if the tree for a specific environment is currently in a collapsed state.
 * Uses a simple heuristic: checks if ANY nodes in the tree are collapsed.
 * This doesn't need to be perfect - just provides visual feedback for the button.
 */
const areNodesCollapsed = (envId: string): boolean => {
  const tree = filteredTree.value[envId];
  if (!tree) {
    return false;
  }

  // Get the scoped ID prefix for this environment
  const prefix = getTreeFocusIdPrefix(envId);
  
  // Collect a few node IDs from the tree to check
  const nodeIds: string[] = [];
  
  // Check root if it has an ID
  if (tree.nodeId) {
    const scopedId = prefix ? `${prefix}${tree.nodeId}` : tree.nodeId;
    nodeIds.push(scopedId);
  }
  
  // Check first-level groups
  for (const subtree of tree.trees.slice(0, 3)) {
    if (subtree.nodeId) {
      const scopedId = prefix ? `${prefix}${subtree.nodeId}` : (subtree.nodeId as string);
      nodeIds.push(scopedId);
    }
  }
  
  // If we found no nodes with IDs, assume not collapsed
  if (nodeIds.length === 0) {
    return false;
  }
  
  // Consider collapsed if majority of checked nodes are collapsed
  const collapsedCount = nodeIds.filter(id => collapsedTrees.value.has(id)).length;
  return collapsedCount > nodeIds.length / 2;
};

/**
 * TreeControls component - provides expand/collapse all button for the suites tree.
 * 
 * Scoped to current environment if one is selected, otherwise affects all environments.
 * Memoized to prevent unnecessary re-renders.
 */
const TreeControlsComponent = () => {
  const { t } = useI18n("controls");
  
  // Get the target environment (current or first available)
  const targetEnv = useMemo(() => {
    const current = currentEnvironment.value;
    if (current) {
      return current;
    }
    // In multi-env view, use first env as indicator
    const firstEnv = Object.keys(filteredTree.value)[0];
    return firstEnv;
  }, [currentEnvironment.value, filteredTree.value]);

  // Check if collapsed - only depends on the root node state for performance
  const isCollapsed = useMemo(() => {
    if (!targetEnv) {
      return false;
    }
    return areNodesCollapsed(targetEnv);
  }, [targetEnv, collapsedTrees.value]);

  const handleToggle = useCallback(() => {
    const envToToggle = currentEnvironment.value; // undefined means all envs
    
    if (isCollapsed) {
      expandAllTreeNodes(envToToggle);
    } else {
      collapseAllTreeNodes(envToToggle);
    }
  }, [isCollapsed, currentEnvironment.value]);

  return (
    <div className={styles.treeControls}>
      <IconButton
        size="s"
        style="ghost"
        icon={isCollapsed ? allureIcons.lineArrowsChevronDown : allureIcons.lineArrowsChevronUp}
        onClick={handleToggle}
        aria-label={isCollapsed ? t("expandAllTree") : t("collapseAllTree")}
        dataTestId="tree-toggle-all"
      />
    </div>
  );
};

// Memoize the component to prevent re-renders from parent
export const TreeControls = memo(TreeControlsComponent);
