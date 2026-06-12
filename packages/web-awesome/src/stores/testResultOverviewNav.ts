import { moveFocus, type FlatTreeNode, type MoveDirection, type MoveFocusResult } from "@allurereport/web-commons";
import { computed, effect, signal } from "@preact/signals";

import { fixtureResultToTrStepItem, getBodyItems } from "@/components/TestResult/bodyItems";
import { isTestResultHotkeysContext } from "@/stores/keyboard";
import { currentTrId, trCurrentTab } from "@/stores/testResult";
import { testResultStore } from "@/stores/testResults";
import { collapsedTrees, isTreeOpened, setTreeOpened, toggleTree } from "@/stores/tree";
import { flattenTestResultOverview } from "@/utils/flattenTestResultOverview";
export const testResultFocusId = signal<string | undefined>(undefined);

/** Set only by explicit keyboard navigation (not auto-initialization). Controls scroll in useTestResultOverviewFocusScroll. */
export const testResultScrollToId = signal<string | undefined>(undefined);

export const isTestResultOverviewNavigationContext = (): boolean =>
  isTestResultHotkeysContext() && trCurrentTab.value === "overview";

const buildFlatOverview = (): FlatTreeNode[] => {
  const testResultId = currentTrId.value;

  if (!testResultId) {
    return [];
  }

  const testResult = testResultStore.value.data?.[testResultId];

  if (!testResult) {
    return [];
  }

  collapsedTrees.value;

  const bodyItems = getBodyItems(testResult, "");
  const setupBodyItems = (testResult.setup ?? []).map((fixture) => fixtureResultToTrStepItem(fixture));
  const teardownBodyItems = (testResult.teardown ?? []).map((fixture) => fixtureResultToTrStepItem(fixture));

  return flattenTestResultOverview({
    testResultId,
    hasSetup: setupBodyItems.length > 0,
    setupBodyItems,
    bodyItems,
    hasTeardown: teardownBodyItems.length > 0,
    teardownBodyItems,
    isGroupOpened: (id, openedByDefault) => isTreeOpened(id, openedByDefault),
  });
};

export const flatTestResultOverview = computed(() => buildFlatOverview());

export const getFlatTestResultNode = (id: string | undefined) =>
  flatTestResultOverview.value.find((node) => node.id === id);

export const moveTestResultFocus = (direction: MoveDirection): MoveFocusResult =>
  moveFocus(flatTestResultOverview.value, testResultFocusId.value, direction);

export const setTestResultFocusId = (id: string | undefined) => {
  testResultFocusId.value = id;
  testResultScrollToId.value = id;
};

export const ensureTestResultFocusId = () => {
  const flat = flatTestResultOverview.value;

  if (flat.length === 0) {
    testResultFocusId.value = undefined;
    return;
  }

  const currentId = testResultFocusId.value;
  const currentExists = currentId ? flat.some((node) => node.id === currentId) : false;

  if (currentExists) {
    return;
  }

  testResultFocusId.value = flat[0]?.id;
};

effect(() => {
  if (!isTestResultOverviewNavigationContext()) {
    return;
  }

  flatTestResultOverview.value;
  ensureTestResultFocusId();
});

effect(() => {
  currentTrId.value;
  trCurrentTab.value;

  if (trCurrentTab.value !== "overview") {
    testResultFocusId.value = undefined;
    testResultScrollToId.value = undefined;
  }
});

const resolveOpenedByDefault = (node: FlatTreeNode) => node.openedByDefault ?? true;

export const applyTestResultFocusMove = (result: MoveFocusResult) => {
  const node = result.nextId ? getFlatTestResultNode(result.nextId) : undefined;

  if (result.collapse && node?.nodeId) {
    setTreeOpened(node.nodeId, false, resolveOpenedByDefault(node));
  }

  if (result.expand && node?.nodeId) {
    setTreeOpened(node.nodeId, true, resolveOpenedByDefault(node));
  }

  if (result.nextId) {
    setTestResultFocusId(result.nextId);
  }
};

export const toggleTestResultFocusNode = () => {
  const node = getFlatTestResultNode(testResultFocusId.value);

  if (!node?.nodeId) {
    return;
  }

  toggleTree(node.nodeId, resolveOpenedByDefault(node));
};
