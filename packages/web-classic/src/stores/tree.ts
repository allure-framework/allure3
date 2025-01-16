import type { WithChildren } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import type { AllureAwesomeStatus, AllureAwesomeTree, AllureAwesomeTreeGroup } from "types";
import { flatten, get } from "underscore";
import type { StoreSignalState } from "@/stores/types";
import { createRecursiveTree, isRecursiveTreeEmpty } from "@/utils/treeFilters";

const flattenChildren = (data) => {
  const result = [];

  const traverse = (node) => {
    if (!node || typeof node !== "object") {
      return;
    }

    // Добавляем текущий узел в результат
    result.push(node);

    // Если есть `children`, рекурсивно обходим их
    if (Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  };

  traverse(data);
  return result;
};
export type TreeSortBy = "order" | "duration" | "status" | "alphabet";
export type TreeDirection = "asc" | "desc";
export type TreeFilters = "flaky" | "retry" | "new";
export type TreeFiltersState = {
  query: string;
  status: AllureAwesomeStatus;
  filter: Record<TreeFilters, boolean>;
  sortBy: TreeSortBy;
  direction: TreeDirection;
};

export const treeStore = signal<StoreSignalState<AllureAwesomeTree>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const noTests = computed(() =>
  treeStore.value?.data?.leavesById ? !Object.keys(treeStore?.value?.data?.leavesById)?.length : true,
);

export const treeFiltersStore = signal<TreeFiltersState>({
  query: "",
  status: "total",
  filter: {
    flaky: false,
    retry: false,
    new: false,
  },
  sortBy: "order",
  direction: "asc",
});

const getFlattenTestResults = (children: WithChildren) => {
  return flatten(
    children.map((child) => {
      if (child.children) {
        return getFlattenTestResults(child.children);
      }
      return child;
    }),
  );
};

export const filteredTree = computed(() => {
  const { root, leavesById, groupsById } = treeStore.value.data;

  return getFlattenTestResults(treeStore.value.data.children);

  // return createRecursiveTree({
  //   group: root as AllureAwesomeTreeGroup,
  //   leavesById,
  //   groupsById,
  //   filterOptions: treeFiltersStore.value,
  // });
});

export const noTestsFound = computed(() => {
  return isRecursiveTreeEmpty(filteredTree.value);
});

export const clearTreeFilters = () => {
  treeFiltersStore.value = {
    query: "",
    status: "total",
    filter: {
      flaky: false,
      retry: false,
      new: false,
    },
    sortBy: "order",
    direction: "asc",
  };
};

export const setTreeQuery = (query: string) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    query,
  };
};

export const setTreeStatus = (status: AllureAwesomeStatus) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    status,
  };
};

export const setTreeSortBy = (sortBy: TreeSortBy) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    sortBy,
  };
};

export const setTreeDirection = (direction: TreeDirection) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    direction,
  };
};

export const setTreeFilter = (filterKey: TreeFilters, value: boolean) => {
  treeFiltersStore.value = {
    ...treeFiltersStore.value,
    filter: {
      ...treeFiltersStore.value.filter,
      [filterKey]: value,
    },
  };
};

export const fetchTreeData = async () => {
  treeStore.value = {
    ...treeStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<AllureAwesomeTree>("/data/suites.json");
    // console.log(res);

    treeStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    treeStore.value = {
      ...treeStore.value,
      error: e.message,
      loading: false,
    };
  }
};
