import type { CategoryNode, TestCategories } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";

import { collapsedTrees } from "@/stores/tree";
import type { StoreSignalState } from "@/stores/types";

export const categoriesStore = signal<StoreSignalState<TestCategories>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const noCategories = computed(() => categoriesStore?.value?.data.roots.length);

let lastCategoriesEnv: string | undefined;

const resolveCategoriesPath = (env?: string) => (env ? `widgets/${env}/categories.json` : "widgets/categories.json");

export const fetchCategoriesData = async (env?: string) => {
  if (lastCategoriesEnv === env && categoriesStore.peek().data) {
    return;
  }
  lastCategoriesEnv = env;
  categoriesStore.value = {
    ...categoriesStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<TestCategories>(resolveCategoriesPath(env));

    categoriesStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    categoriesStore.value = {
      ...categoriesStore.value,
      error: undefined,
      loading: false,
    };
  }
};

export type CategoryBreadcrumb = {
  nodeId: string;
  name: string;
};

export const pendingCategoryScrollId = signal<string | undefined>(undefined);

export const isCategoryNodeOpenedByDefault = (node?: CategoryNode) =>
  node?.type === "category" ? Boolean(node.expand) : true;

/**
 * Presence in `collapsedTrees` means "flipped from the node's default state".
 */
export const isCategoryNodeOpened = (nodeId: string, store: TestCategories) => {
  const openedByDefault = isCategoryNodeOpenedByDefault(store.nodes[nodeId]);

  return collapsedTrees.value.has(nodeId) ? !openedByDefault : openedByDefault;
};

/**
 * Path of the test result through the categories tree, so every segment points to an existing node.
 */
export const getCategoriesBreadcrumbs = (testResultId?: string): CategoryBreadcrumb[] => {
  const store = categoriesStore.value.data;

  if (!testResultId || !store) {
    return [];
  }

  const walk = (nodeId: string, path: CategoryBreadcrumb[]): CategoryBreadcrumb[] | undefined => {
    const node = store.nodes[nodeId];

    if (!node) {
      return undefined;
    }

    if (node.type === "tr") {
      return node.id === testResultId ? path : undefined;
    }

    for (const childId of node.childrenIds ?? []) {
      const found = walk(childId, [...path, { nodeId, name: node.name }]);

      if (found) {
        return found;
      }
    }

    return undefined;
  };

  for (const rootId of store.roots) {
    const found = walk(rootId, []);

    if (found) {
      return found;
    }
  }

  return [];
};

/**
 * Opens every node of the path, then marks the last one to be scrolled into view by the tree.
 */
export const revealCategoryNode = (path: string[]) => {
  const store = categoriesStore.peek().data;

  if (!store || path.length === 0) {
    return;
  }

  const nextCollapsedTrees = new Set(collapsedTrees.peek());

  for (const nodeId of path) {
    if (isCategoryNodeOpenedByDefault(store.nodes[nodeId])) {
      nextCollapsedTrees.delete(nodeId);
    } else {
      nextCollapsedTrees.add(nodeId);
    }
  }

  collapsedTrees.value = nextCollapsedTrees;
  pendingCategoryScrollId.value = path[path.length - 1];
};
