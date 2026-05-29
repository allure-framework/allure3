import type { HotkeyScope, MoveDirection } from "@allurereport/web-commons";
import {
  applySubtreeToggleState,
  collectExpandableSubtreeNodes,
  getExpandableDescendants,
  hasExpandableTreeChildren,
  resolveNextSubtreeToggleState,
  scrollTreePaneToTop,
  type SubtreeNodeState,
  type SubtreeToggleState,
} from "@allurereport/web-commons";
import type { RecursiveTree } from "@allurereport/web-components/global";
import { computed } from "@preact/signals";

import { getBodyItems } from "@/components/TestResult/bodyItems";
import {
  collectExpandableStepNodes,
  findStepBodyItems,
  getStepTreeExpansionPolicy,
} from "@/components/TestResult/TrSteps/stepTreeExpansion";
import { collapsedEnvironments, currentEnvironment, environmentsStore } from "@/stores/env";
import {
  activePane,
  flatTree,
  focusTestResultPane,
  focusTreePane,
  getFlatTreeNode,
  isReportRootTabsContext,
  isSearchInput,
  isTestResultHotkeysContext,
  isTreeNavigationContext,
  lastSubtreeToggleByScope,
  moveTreeFocus,
  pendingVimKey,
  setTreeFocusId,
  treeFocusId,
  treeScrollPaneToTopPending,
} from "@/stores/keyboard";
import { isSplitMode } from "@/stores/layout";
import { isModalOpen } from "@/stores/modal";
import { getReportEnvSectionId, type ReportEnvSection } from "@/stores/reportEnvSections";
import { cycleReportRootTab, navigateToReportRootTab, REPORT_ROOT_TAB } from "@/stores/reportRootTabs";
import { navigateToRoot, navigateToTestResult, rootTabRoute, testResultRoute } from "@/stores/router";
import { currentSection } from "@/stores/sections";
import { currentTrId, trCurrentTab } from "@/stores/testResult";
import {
  applyTestResultFocusMove,
  getFlatTestResultNode,
  isTestResultOverviewNavigationContext,
  moveTestResultFocus,
  testResultFocusId,
  toggleTestResultFocusNode,
} from "@/stores/testResultOverviewNav";
import { testResultNavStore, testResultStore } from "@/stores/testResults";
import { cycleTestResultTab, navigateToTestResultTabById, TEST_RESULT_TAB } from "@/stores/testResultTabs";
import { filteredTree, isTreeOpened, setTreeOpened, toggleTree } from "@/stores/tree";

const isTestResultRoute = computed(
  () => testResultRoute.value.matches || Boolean(rootTabRoute.value.params.testResultId),
);

export const getHotkeyScope = (): HotkeyScope => {
  if (isSplitMode.value) {
    return activePane.value === "testResult" ? "testResult" : "tree";
  }

  if (activePane.value === "testResult" && isTestResultHotkeysContext()) {
    return "testResult";
  }

  if (isReportRootTabsContext()) {
    return "tree";
  }

  if (isTreeNavigationContext()) {
    return "tree";
  }

  return "global";
};

export const isHotkeysEnabled = (): boolean => {
  if (isModalOpen.value) {
    return false;
  }

  if (currentSection.value !== "default") {
    return false;
  }

  return true;
};

const resolveTreeOpenedByDefault = (node: ReturnType<typeof getFlatTreeNode>) => node?.openedByDefault ?? true;

const applyTreeMoveResult = (result: ReturnType<typeof moveTreeFocus>, options?: { scrollPaneToTop?: boolean }) => {
  const node = result.nextId ? getFlatTreeNode(result.nextId) : undefined;
  const openedByDefault = resolveTreeOpenedByDefault(node);

  if (result.collapse && node) {
    if (node.kind === "env" && node.nodeId && !collapsedEnvironments.value.includes(node.nodeId)) {
      collapsedEnvironments.value = collapsedEnvironments.value.concat(node.nodeId);
    } else if (node.kind === "group") {
      toggleTree(node.id, openedByDefault);
    }
  }

  if (result.expand && node) {
    if (node.kind === "env" && node.nodeId) {
      collapsedEnvironments.value = collapsedEnvironments.value.filter((envId) => envId !== node.nodeId);
    } else if (node.kind === "group") {
      toggleTree(node.id, openedByDefault);
    }
  }

  if (result.nextId) {
    setTreeFocusId(result.nextId);
  }

  if (options?.scrollPaneToTop) {
    treeScrollPaneToTopPending.value = true;
  }
};

export const scrollTreeListToTop = () => {
  if (!isTreeNavigationContext()) {
    return;
  }

  const anchor = treeFocusId.value ? document.querySelector(`[data-tree-node-id="${treeFocusId.value}"]`) : null;

  scrollTreePaneToTop(anchor instanceof HTMLElement ? anchor : null);
};

export const applyTreeNavigation = (direction: MoveDirection | "g" | "gg" | "z" | "zt" | "t") => {
  if (!isTreeNavigationContext()) {
    return;
  }

  if (direction === "t") {
    if (pendingVimKey.value === "z") {
      pendingVimKey.value = null;
      scrollTreeListToTop();
    }

    return;
  }

  if (direction === "z") {
    pendingVimKey.value = "z";
    window.setTimeout(() => {
      if (pendingVimKey.value === "z") {
        pendingVimKey.value = null;
      }
    }, 800);
    return;
  }

  if (direction === "zt") {
    scrollTreeListToTop();
    return;
  }

  if (direction === "g") {
    if (pendingVimKey.value === "g") {
      pendingVimKey.value = null;
      applyTreeMoveResult(moveTreeFocus("firstLeaf"), { scrollPaneToTop: true });
      return;
    }

    pendingVimKey.value = "g";
    window.setTimeout(() => {
      if (pendingVimKey.value === "g") {
        pendingVimKey.value = null;
      }
    }, 800);
    return;
  }

  if (direction === "gg") {
    applyTreeMoveResult(moveTreeFocus("firstLeaf"), { scrollPaneToTop: true });
    return;
  }

  applyTreeMoveResult(moveTreeFocus(direction), { scrollPaneToTop: direction === "home" });
};

const setFocusedNodeExpanded = (expanded: boolean) => {
  const node = getFlatTreeNode(treeFocusId.value);

  if (!node?.nodeId) {
    return;
  }

  if (node.kind === "env") {
    const isOpened = !collapsedEnvironments.value.includes(node.nodeId);

    if (isOpened === expanded) {
      return;
    }

    collapsedEnvironments.value = expanded
      ? collapsedEnvironments.value.filter((envId) => envId !== node.nodeId)
      : collapsedEnvironments.value.concat(node.nodeId);
    return;
  }

  if (node.kind === "group") {
    setTreeOpened(node.id, expanded, resolveTreeOpenedByDefault(node));
  }
};

export const collapseAllChildrenFromFocus = () => {
  if (!isTreeNavigationContext()) {
    return;
  }

  const focusId = treeFocusId.value;

  if (!focusId) {
    return;
  }

  for (const node of getExpandableDescendants(flatTree.value, focusId)) {
    if (!node.nodeId) {
      continue;
    }

    if (node.kind === "env") {
      if (!collapsedEnvironments.value.includes(node.nodeId)) {
        collapsedEnvironments.value = collapsedEnvironments.value.concat(node.nodeId);
      }
      continue;
    }

    if (node.kind === "group") {
      const openedByDefault = node.openedByDefault ?? true;

      if (isTreeOpened(node.id, openedByDefault)) {
        setTreeOpened(node.id, false, openedByDefault);
      }
    }
  }
};

export const expandAllChildrenFromFocus = () => {
  if (!isTreeNavigationContext()) {
    return;
  }

  const focusId = treeFocusId.value;

  if (!focusId) {
    return;
  }

  setFocusedNodeExpanded(true);

  for (const node of getExpandableDescendants(flatTree.value, focusId)) {
    if (!node.nodeId) {
      continue;
    }

    if (node.kind === "env") {
      collapsedEnvironments.value = collapsedEnvironments.value.filter((envId) => envId !== node.nodeId);
      continue;
    }

    if (node.kind === "group") {
      const openedByDefault = node.openedByDefault ?? true;

      if (!isTreeOpened(node.id, openedByDefault)) {
        setTreeOpened(node.id, true, openedByDefault);
      }
    }
  }
};

const findGroupInTree = (tree: RecursiveTree, targetNodeId: string): RecursiveTree | null => {
  if (tree.nodeId === targetNodeId) {
    return tree;
  }

  for (const nested of tree.trees) {
    const found = findGroupInTree(nested, targetNodeId);

    if (found) {
      return found;
    }
  }

  return null;
};

const resolveTreeEnvId = (focusId: string): string | undefined => {
  const envIds = new Set(environmentsStore.value.data.map((env) => env.id));
  const colonIndex = focusId.indexOf(":");

  if (colonIndex > 0) {
    const prefix = focusId.slice(0, colonIndex);

    if (envIds.has(prefix)) {
      return prefix;
    }
  }

  if (envIds.size === 1) {
    return environmentsStore.value.data[0]?.id;
  }

  if (currentEnvironment.value && envIds.has(currentEnvironment.value)) {
    return currentEnvironment.value;
  }

  return Object.keys(filteredTree.value).find((envId) => envIds.has(envId));
};

const getTreeFocusIdPrefix = (envId: string): string | undefined => {
  if (environmentsStore.value.data.length <= 1) {
    return undefined;
  }

  if (currentEnvironment.value) {
    return undefined;
  }

  return `${envId}:`;
};

export const setFocusedSubtreeToggleState = (state: SubtreeToggleState) => {
  if (!isTreeNavigationContext()) {
    return;
  }

  const focusId = treeFocusId.value;

  if (!focusId) {
    return;
  }

  const flatNode = getFlatTreeNode(focusId);

  if (!flatNode || flatNode.kind !== "group" || !flatNode.nodeId) {
    return;
  }

  const envId = resolveTreeEnvId(focusId);
  const envTree = envId ? filteredTree.value[envId] : undefined;

  if (!envTree) {
    return;
  }

  const groupTree = findGroupInTree(envTree, flatNode.nodeId);

  if (!groupTree || !hasExpandableTreeChildren(groupTree)) {
    return;
  }

  const focusIdPrefix = envId ? getTreeFocusIdPrefix(envId) : undefined;
  const toScopedId = (nodeId: string) => (focusIdPrefix ? `${focusIdPrefix}${nodeId}` : nodeId);
  const expandableSubtreeNodes = collectExpandableSubtreeNodes(groupTree);

  applySubtreeToggleState(expandableSubtreeNodes, state, {
    toScopedId,
    isOpened: (scopedId, openedByDefault) => isTreeOpened(scopedId, openedByDefault),
    setOpened: (scopedId, shouldOpen, openedByDefault) => setTreeOpened(scopedId, shouldOpen, openedByDefault),
  });
};

export const collapseFocusedSubtree = () => setFocusedSubtreeToggleState("none");

export const expandFocusedSubtree = () => setFocusedSubtreeToggleState("all");

export const expandFocusedSubtreeFirstLevel = () => setFocusedSubtreeToggleState("first");

const rememberSubtreeToggle = (scopeKey: string, nextLastToggle: SubtreeToggleState | null) => {
  const next = { ...lastSubtreeToggleByScope.value };

  if (nextLastToggle) {
    next[scopeKey] = nextLastToggle;
  } else {
    delete next[scopeKey];
  }

  lastSubtreeToggleByScope.value = next;
};

const getRememberedSubtreeToggle = (scopeKey: string): SubtreeToggleState | null =>
  lastSubtreeToggleByScope.value[scopeKey] ?? null;

export const cycleFocusedSubtreeToggle = () => {
  if (!isTreeNavigationContext()) {
    return;
  }

  const focusId = treeFocusId.value;

  if (!focusId) {
    return;
  }

  const flatNode = getFlatTreeNode(focusId);

  if (!flatNode || flatNode.kind !== "group" || !flatNode.nodeId) {
    return;
  }

  const envId = resolveTreeEnvId(focusId);
  const envTree = envId ? filteredTree.value[envId] : undefined;

  if (!envTree) {
    return;
  }

  const groupTree = findGroupInTree(envTree, flatNode.nodeId);

  if (!groupTree || !hasExpandableTreeChildren(groupTree)) {
    return;
  }

  const focusIdPrefix = envId ? getTreeFocusIdPrefix(envId) : undefined;
  const toScopedId = (nodeId: string) => (focusIdPrefix ? `${focusIdPrefix}${nodeId}` : nodeId);
  const expandableSubtreeNodes = collectExpandableSubtreeNodes(groupTree);
  const isOpened = (nodeId: string, openedByDefault: boolean) => isTreeOpened(toScopedId(nodeId), openedByDefault);
  const { nextState, nextLastToggle } = resolveNextSubtreeToggleState(
    expandableSubtreeNodes,
    isOpened,
    getRememberedSubtreeToggle(focusId),
  );

  applySubtreeToggleState(expandableSubtreeNodes, nextState, {
    toScopedId,
    isOpened: (scopedId, openedByDefault) => isTreeOpened(scopedId, openedByDefault),
    setOpened: (scopedId, shouldOpen, openedByDefault) => setTreeOpened(scopedId, shouldOpen, openedByDefault),
  });
  rememberSubtreeToggle(focusId, nextLastToggle);
};

export const cycleFocusedTestResultSubtreeToggle = () => {
  if (!isTestResultOverviewNavigationContext()) {
    return;
  }

  const focusId = testResultFocusId.value;

  if (!focusId) {
    return;
  }

  const flatNode = getFlatTestResultNode(focusId);

  if (!flatNode?.nodeId || flatNode.kind !== "group") {
    return;
  }

  const testResultId = currentTrId.value;
  const testResult = testResultId ? testResultStore.value.data?.[testResultId] : undefined;

  if (!testResult) {
    return;
  }

  const policy = getStepTreeExpansionPolicy();
  const bodyItems = getBodyItems(testResult, "");
  const stepBodyItems = findStepBodyItems(bodyItems, flatNode.nodeId);

  if (!stepBodyItems) {
    return;
  }

  const openedByDefault = flatNode.openedByDefault ?? true;
  const expandableDescendants = collectExpandableStepNodes(stepBodyItems, policy);

  if (expandableDescendants.length === 0) {
    return;
  }

  const subtreeNodes: SubtreeNodeState[] = [
    { id: flatNode.nodeId, openedByDefault, isRoot: true },
    ...expandableDescendants.map((node) => ({ ...node, isRoot: false })),
  ];
  const isOpened = (id: string, defaultOpened: boolean) => isTreeOpened(id, defaultOpened);
  const { nextState, nextLastToggle } = resolveNextSubtreeToggleState(
    subtreeNodes,
    isOpened,
    getRememberedSubtreeToggle(focusId),
  );

  applySubtreeToggleState(subtreeNodes, nextState, {
    toScopedId: (id) => id,
    isOpened,
    setOpened: (id, shouldOpen, defaultOpened) => setTreeOpened(id, shouldOpen, defaultOpened),
  });
  rememberSubtreeToggle(focusId, nextLastToggle);
};

export const openTreeNodeFromFocus = () => {
  if (!isTreeNavigationContext()) {
    return;
  }

  const node = getFlatTreeNode(treeFocusId.value);

  if (!node) {
    return;
  }

  if (node.kind === "leaf" && node.testResultId) {
    openTestResultFromTree();
    return;
  }

  if (node.kind === "group" || node.kind === "env") {
    toggleTreeNodeFromFocus();
  }
};

export const toggleTreeNodeFromFocus = () => {
  if (!isTreeNavigationContext()) {
    return;
  }

  const node = getFlatTreeNode(treeFocusId.value);

  if (!node) {
    return;
  }

  if (node.kind === "env" && node.nodeId) {
    const isOpened = !collapsedEnvironments.value.includes(node.nodeId);
    collapsedEnvironments.value = isOpened
      ? collapsedEnvironments.value.concat(node.nodeId)
      : collapsedEnvironments.value.filter((envId) => envId !== node.nodeId);
    return;
  }

  if (node.kind === "group") {
    toggleTree(node.id, resolveTreeOpenedByDefault(node));
  }
};

export const openTestResultFromTree = () => {
  if (!isTreeNavigationContext()) {
    return;
  }

  const node = getFlatTreeNode(treeFocusId.value);

  if (!node || node.kind !== "leaf" || !node.testResultId) {
    return;
  }

  navigateToTestResult({ testResultId: node.testResultId, tab: trCurrentTab.value });

  if (isSplitMode.value) {
    focusTestResultPane();
  } else {
    focusTestResultPane();
  }
};

export const getSearchInput = (): HTMLInputElement | null =>
  document.querySelector<HTMLInputElement>('[data-testid="search-input"]') ??
  document.querySelector<HTMLInputElement>('input[name="search"]');

export const focusSearch = () => {
  const input = getSearchInput();

  if (!input) {
    return;
  }

  input.focus();
  input.select();
};

export const blurSearch = () => {
  const active = document.activeElement;

  if (!isSearchInput(active)) {
    return;
  }

  active.blur();
};

export const focusTestResultPaneIfOpen = () => {
  if (isSplitMode.value) {
    focusTestResultPane();
    return;
  }

  if (isTestResultRoute.value || currentTrId.value) {
    focusTestResultPane();
  }
};

/**
 * Returns the ordered list of test result IDs for prev/next navigation.
 *
 * - Split mode: only tests visible in the tree (respects collapsed folders).
 * - Base layout: full nav.json list, matching the pagination widget order.
 */
const getNavLeafIds = (): string[] => {
  if (isSplitMode.value) {
    return flatTree.value.flatMap((node) => (node.kind === "leaf" && node.testResultId ? [node.testResultId] : []));
  }

  return testResultNavStore.value.data ?? [];
};

export const goToPrevTestResult = () => {
  if (!isTestResultHotkeysContext()) {
    return;
  }

  const currentId = currentTrId.value;

  if (!currentId) {
    return;
  }

  const leafIds = getNavLeafIds();
  const currentIndex = leafIds.indexOf(currentId);

  if (currentIndex <= 0) {
    return;
  }

  const prevId = leafIds[currentIndex - 1];

  if (!prevId) {
    return;
  }

  navigateToTestResult({ testResultId: prevId, tab: trCurrentTab.value });
  setTreeFocusId(undefined);
};

export const goToNextTestResult = () => {
  if (!isTestResultHotkeysContext()) {
    return;
  }

  const currentId = currentTrId.value;

  if (!currentId) {
    return;
  }

  const leafIds = getNavLeafIds();
  const currentIndex = leafIds.indexOf(currentId);

  if (currentIndex === -1 || currentIndex >= leafIds.length - 1) {
    return;
  }

  const nextId = leafIds[currentIndex + 1];

  if (!nextId) {
    return;
  }

  navigateToTestResult({ testResultId: nextId, tab: trCurrentTab.value });
  setTreeFocusId(undefined);
};

export const navigateDownInTestResultPane = () => goToNextTestResult();

export const navigateUpInTestResultPane = () => goToPrevTestResult();

export const goToTestResultTab = (tab: string) => {
  if (!isTestResultHotkeysContext()) {
    return;
  }

  navigateToTestResultTabById(tab as (typeof TEST_RESULT_TAB)[keyof typeof TEST_RESULT_TAB]);
};

export const goToReportRootTab = (tab: (typeof REPORT_ROOT_TAB)[keyof typeof REPORT_ROOT_TAB]) => {
  if (!isReportRootTabsContext()) {
    return;
  }

  navigateToReportRootTab(tab);
  focusTreePane();
};

export const cycleReportRootTabHotkey = (direction: "next" | "prev") => {
  if (!isReportRootTabsContext()) {
    return;
  }

  cycleReportRootTab(direction);
  focusTreePane();
};

export const cycleTestResultTabHotkey = (direction: "next" | "prev") => {
  if (!isTestResultHotkeysContext()) {
    return;
  }

  cycleTestResultTab(direction);
};

export const toggleReportEnvSection = (section: ReportEnvSection) => {
  if (!isTreeNavigationContext()) {
    return;
  }

  toggleTree(getReportEnvSectionId(section));
};

export const toggleMetadataSection = (section: "labels" | "parameters" | "links") => {
  if (!isTestResultHotkeysContext()) {
    return;
  }

  const testResultId = currentTrId.value;

  if (!testResultId || trCurrentTab.value !== "overview") {
    return;
  }

  toggleTree(`${testResultId}-${section}`);
};

export const applyTestResultOverviewNavigation = (direction: MoveDirection) => {
  if (!isTestResultOverviewNavigationContext()) {
    return;
  }

  applyTestResultFocusMove(moveTestResultFocus(direction));
};

export const toggleTestResultOverviewNode = () => {
  if (!isTestResultOverviewNavigationContext()) {
    return;
  }

  toggleTestResultFocusNode();
};

export const openTestResultOverviewFromFocus = () => {
  if (!isTestResultOverviewNavigationContext()) {
    return;
  }

  const node = getFlatTestResultNode(testResultFocusId.value);

  if (!node) {
    return;
  }

  if (node.nodeId) {
    toggleTestResultFocusNode();
  }
};

export const handleTestResultEscape = () => {
  if (isSplitMode.value) {
    focusTreePane();
    return;
  }

  navigateToRoot();
  focusTreePane();
};
