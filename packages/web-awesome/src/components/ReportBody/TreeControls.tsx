import { IconButton, allureIcons } from "@allurereport/web-components";
import { memo } from "preact/compat";
import { useCallback, useMemo } from "preact/hooks";

import { currentEnvironment } from "@/stores/env";
import { collapseAllTreeNodes, expandAllTreeNodes } from "@/stores/keyboardActions";
import { useI18n } from "@/stores/locale";
import { collapsedTrees, filteredTree } from "@/stores/tree";

import * as styles from "./styles.scss";

/**
 * Check if most nodes in a specific environment's tree are collapsed.
 * This is a simple heuristic - doesn't need to be perfect, just gives visual feedback.
 */
const areNodesCollapsed = (envId: string): boolean => {
  const tree = filteredTree.value[envId];
  if (!tree) {
    return false;
  }

  // Simple heuristic: if the root node itself is collapsed, consider it "collapsed"
  // This avoids walking the entire tree on every render
  const rootId = tree.nodeId as string;
  if (!rootId) {
    return false;
  }

  return collapsedTrees.value.has(rootId);
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
