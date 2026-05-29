import {
  flattenVisibleTree,
  moveFocus,
  router,
  type FlatTreeNode,
  type MoveDirection,
  type MoveFocusResult,
  type SubtreeToggleState,
} from "@allurereport/web-commons";
import type { RecursiveTree } from "@allurereport/web-components/global";
import { computed, effect, signal } from "@preact/signals";

import { statsByEnvStore } from "@/stores";
import { collapsedEnvironments, currentEnvironment, environmentsStore } from "@/stores/env";
import { isSplitMode } from "@/stores/layout";
import { rootTabRoute, testResultRoute } from "@/stores/router";
import { currentSection } from "@/stores/sections";
import { currentTrId } from "@/stores/testResult";
import {
  collapsedTrees,
  expandedTrees,
  filteredTree,
  isTreeOpened,
  noTests,
  noTestsFound,
  setTreeOpened,
} from "@/stores/tree";

export type ActivePane = "tree" | "testResult";

export const activePane = signal<ActivePane>("tree");
export const treeFocusId = signal<string | undefined>(undefined);
export const hotkeysHelpOpen = signal(false);
export const pendingVimKey = signal<string | null>(null);

/** Last subtree cycle action per focused group/step (matches header chevron button memory). */
export const lastSubtreeToggleByScope = signal<Record<string, SubtreeToggleState>>({});
/** When true, the next tree focus scroll snaps the list pane to scrollTop 0 (Home / gg / zt). */
export const treeScrollPaneToTopPending = signal(false);

export const focusTreePane = () => {
  activePane.value = "tree";
};

export const focusTestResultPane = () => {
  activePane.value = "testResult";
};

effect(() => {
  document.documentElement.setAttribute("data-active-pane", activePane.value);
});

export const toggleHotkeysHelp = () => {
  hotkeysHelpOpen.value = !hotkeysHelpOpen.value;
};

export const isSearchInput = (element: Element | null): element is HTMLInputElement =>
  element instanceof HTMLInputElement && (element.name === "search" || element.dataset.testid === "search-input");

const releaseDetachedFocus = () => {
  const active = document.activeElement;

  if (isSearchInput(active)) {
    return;
  }

  if (active instanceof HTMLElement && active !== document.body) {
    active.blur();
  }
};

/** Main report tabs (Results, Categories, …) are on screen and hotkeys may switch them. */
export const isReportRootTabsContext = (): boolean => {
  if (currentSection.value !== "default") {
    return false;
  }

  if (isSplitMode.value) {
    return true;
  }

  if (testResultRoute.value.matches) {
    return false;
  }

  return true;
};

/** Test-results tree is visible (Results tab or split left pane), not Categories/other tabs. */
export const isReportResultsTreeVisible = (): boolean => {
  if (currentSection.value !== "default") {
    return false;
  }

  if (testResultRoute.value.matches && !isSplitMode.value) {
    return false;
  }

  if (rootTabRoute.value.matches) {
    const rootTab = rootTabRoute.value.params.rootTab;

    return rootTab === "results";
  }

  return true;
};

export const isTreeNavigationContext = (): boolean => {
  if (!isReportResultsTreeVisible()) {
    return false;
  }

  if (isSplitMode.value) {
    return activePane.value === "tree";
  }

  return true;
};

export const isTestResultHotkeysContext = (): boolean => {
  if (!currentTrId.value) {
    return false;
  }

  if (isSplitMode.value) {
    return activePane.value === "testResult";
  }

  return testResultRoute.value.matches || Boolean(rootTabRoute.value.params.testResultId);
};

export const syncKeyboardStateFromRoute = () => {
  pendingVimKey.value = null;
  releaseDetachedFocus();

  if (currentSection.value !== "default") {
    return;
  }

  ensureTreeFocusId();

  const hasTest = Boolean(currentTrId.value);
  const split = isSplitMode.value;
  const fullPageTest = testResultRoute.value.matches && !split;

  if (fullPageTest) {
    focusTestResultPane();
    return;
  }

  if (split && !hasTest) {
    focusTreePane();
    return;
  }

  if (!split && !hasTest) {
    focusTreePane();
  }
};

export const isHotkeyScopeActive = (scope: "global" | "tree" | "testResult"): boolean => {
  if (isSplitMode.value) {
    return scope === "global" || scope === activePane.value;
  }

  if (scope === "tree") {
    return isReportRootTabsContext() && (isSplitMode.value ? activePane.value === "tree" : true);
  }

  if (scope === "testResult") {
    return isTestResultHotkeysContext();
  }

  return true;
};

const buildEnvSections = () => {
  const envs = environmentsStore.value.data;

  return Object.entries(filteredTree.value)
    .map(([envId, tree]) => {
      const stats = statsByEnvStore.value.data[envId];

      if ((stats?.total ?? 0) === 0) {
        return null;
      }

      return {
        id: envId,
        opened: !collapsedEnvironments.value.includes(envId),
        tree: tree as RecursiveTree,
        statistic: stats,
      };
    })
    .filter((section): section is NonNullable<typeof section> => section !== null);
};

const flattenTreeForKeyboard = (options: {
  tree: Parameters<typeof flattenVisibleTree>[0]["tree"];
  isRoot?: boolean;
  rootStatistic?: Parameters<typeof flattenVisibleTree>[0]["rootStatistic"];
  envSections?: Parameters<typeof flattenVisibleTree>[0]["envSections"];
}) => {
  collapsedTrees.value;
  expandedTrees.value;

  return flattenVisibleTree({
    collapsedTrees: collapsedTrees.value,
    isGroupOpened: (scopedNodeId, openedByDefault) => isTreeOpened(scopedNodeId, openedByDefault),
    ...options,
  });
};

export const flatTree = computed((): FlatTreeNode[] => {
  if (noTests.value || noTestsFound.value) {
    return [];
  }

  const envs = environmentsStore.value.data;
  const trees = filteredTree.value;

  if (envs.length === 1) {
    const soleId = envs[0]!.id;
    const tree = trees[soleId];

    if (!tree) {
      return [];
    }

    return flattenTreeForKeyboard({
      tree,
      isRoot: true,
      rootStatistic: statsByEnvStore.value.data[soleId],
    });
  }

  const currentTree = currentEnvironment.value ? trees[currentEnvironment.value] : undefined;

  if (currentTree) {
    return flattenTreeForKeyboard({
      tree: currentTree,
      isRoot: true,
      rootStatistic: statsByEnvStore.value.data[currentEnvironment.value],
    });
  }

  return flattenTreeForKeyboard({
    envSections: buildEnvSections(),
  });
});

export const getFlatTreeNode = (id: string | undefined) => flatTree.value.find((node) => node.id === id);

export const moveTreeFocus = (direction: MoveDirection): MoveFocusResult => {
  return moveFocus(flatTree.value, treeFocusId.value, direction);
};

export const setTreeFocusId = (id: string | undefined) => {
  treeFocusId.value = id;
};

export const ensureTreeFocusId = () => {
  const flat = flatTree.value;

  if (flat.length === 0) {
    treeFocusId.value = undefined;
    return;
  }

  // Use peek() so that changes to treeFocusId itself do not re-trigger this effect —
  // treeFocusId is the *output* here, not the trigger.
  const currentId = treeFocusId.peek();
  const currentExists = currentId ? flat.some((node) => node.id === currentId) : false;

  if (currentExists) {
    return;
  }

  const routeId = currentTrId.value;
  const routeNode = routeId ? flat.find((node) => node.testResultId === routeId || node.id === routeId) : undefined;

  const firstLeaf = flat.find((node) => node.kind === "leaf");
  treeFocusId.value = routeNode?.id ?? firstLeaf?.id ?? flat[0]?.id;
};

effect(() => {
  flatTree.value;
  ensureTreeFocusId();
});

effect(() => {
  currentSection.value;
  currentTrId.value;
  router.value.path;
  isSplitMode.value;
  syncKeyboardStateFromRoute();
});

const expandPathToLeaf = (tree: RecursiveTree, targetNodeId: string, prefix: string | undefined): boolean => {
  for (const leaf of tree.leaves) {
    if (leaf.nodeId === targetNodeId) {
      return true;
    }
  }

  for (const sub of tree.trees) {
    if (expandPathToLeaf(sub, targetNodeId, prefix)) {
      const scopedId = prefix ? `${prefix}${sub.nodeId}` : sub.nodeId;
      const openedByDefault = !sub.statistic || Boolean(sub.statistic.failed || sub.statistic.broken);
      const isOpen = openedByDefault ? !collapsedTrees.peek().has(scopedId) : expandedTrees.peek().has(scopedId);

      if (!isOpen) {
        setTreeOpened(scopedId, true, openedByDefault);
      }

      return true;
    }
  }

  return false;
};

const expandAndFocusCurrentTest = () => {
  const testResultId = currentTrId.peek();

  if (!testResultId) {
    return;
  }

  const flat = flatTree.peek();
  const existing = flat.find((n) => n.kind === "leaf" && n.testResultId === testResultId);

  if (existing) {
    treeFocusId.value = existing.id;
    return;
  }

  const envs = environmentsStore.peek().data ?? [];
  const trees = filteredTree.peek();
  const curEnv = currentEnvironment.peek();
  const usePrefix = envs.length > 1 && !curEnv;

  for (const env of envs) {
    const envTree = trees[env.id];

    if (!envTree) {
      continue;
    }

    const prefix = usePrefix ? `${env.id}:` : undefined;

    if (expandPathToLeaf(envTree, testResultId, prefix)) {
      treeFocusId.value = prefix ? `${prefix}${testResultId}` : testResultId;
      return;
    }
  }
};

let prevIsSplitMode = isSplitMode.peek();

effect(() => {
  const nowSplit = isSplitMode.value;

  try {
    if (nowSplit && !prevIsSplitMode) {
      expandAndFocusCurrentTest();
    }
  } finally {
    prevIsSplitMode = nowSplit;
  }
});
