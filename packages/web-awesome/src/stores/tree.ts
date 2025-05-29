import { fetchReportJsonData } from "@allurereport/web-commons";
import type { RecursiveTree } from "@allurereport/web-components/global";
import { computed, effect, signal } from "@preact/signals";
import type { AwesomeStatus, AwesomeTree, AwesomeTreeGroup } from "types";
import type { StoreSignalState } from "@/stores/types";
import { loadFromLocalStorage } from "@/utils/loadFromLocalStorage";
import { createRecursiveTree, isRecursiveTreeEmpty } from "@/utils/treeFilters";

export type TreeSortBy = "order" | "duration" | "status" | "alphabet";
export type TreeDirection = "asc" | "desc";
export type TreeFilters = "flaky" | "retry" | "new" | "fixed" | "regressed" | "malfunctioned";
export type TreeFiltersState = {
  query: string;
  status: AwesomeStatus;
  filter: Record<TreeFilters, boolean>;
  sortBy: TreeSortBy;
  direction: TreeDirection;
};

export const treeStore = signal<StoreSignalState<Record<string, AwesomeTree>>>({
  loading: true,
  error: undefined,
  data: undefined,
});

export const noTests = computed(() => {
  return Object.values(treeStore?.value?.data ?? {}).every(
    ({ leavesById }) => !leavesById || !Object.keys(leavesById).length,
  );
});

export const collapsedTrees = signal(new Set(loadFromLocalStorage<string[]>("collapsedTrees", [])));

effect(() => {
  localStorage.setItem("collapsedTrees", JSON.stringify([...collapsedTrees.value]));
});

export const toggleTree = (id: string) => {
  const newSet = new Set(collapsedTrees.value);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  collapsedTrees.value = newSet;
};

export const selectedFilters = signal(new Set(loadFromLocalStorage("selectedFilters", []) as []));

effect(() => {
  localStorage.setItem("selectedFilters", JSON.stringify([...selectedFilters.value]));
});

export const treeFiltersStore = signal<TreeFiltersState>(
  loadFromLocalStorage<TreeFiltersState>("treeFilters", {
    query: "",
    status: "total",
    filter: {
      flaky: false,
      retry: false,
      new: false,
      fixed: false,
      regressed: false,
      malfunctioned: false,
    },
    sortBy: "order",
    direction: "asc",
  }) as TreeFiltersState,
);

effect(() => {
  localStorage.setItem("treeFilters", JSON.stringify(treeFiltersStore.value));
});

export const filteredTree = computed(() => {
  return Object.entries(treeStore.value.data).reduce(
    (acc, [key, value]) => {
      if (!value) {
        return acc;
      }

      const { root, leavesById, groupsById } = value;
      const tree = createRecursiveTree({
        group: root as AwesomeTreeGroup,
        leavesById,
        groupsById,
        filterOptions: treeFiltersStore.value,
      });

      return Object.assign(acc, {
        [key]: tree,
      });
    },
    {} as Record<string, RecursiveTree>,
  );
});

export const noTestsFound = computed(() => {
  return Object.values(filteredTree.value).every(isRecursiveTreeEmpty);
});

export const clearTreeFilters = () => {
  treeFiltersStore.value = {
    query: "",
    status: "total",
    filter: {
      flaky: false,
      retry: false,
      new: false,
      fixed: false,
      regressed: false,
      malfunctioned: false,
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

export const setTreeStatus = (status: AwesomeStatus) => {
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

export const fetchEnvTreesData = async (envs: string[]) => {
  const envsToFetch = envs.filter((env) => !treeStore.value.data?.[env]);

  // all envs have already been fetched
  if (envsToFetch.length === 0) {
    return;
  }

  treeStore.value = {
    ...treeStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const data = await Promise.all(
      envsToFetch.map((env) => fetchReportJsonData<AwesomeTree>(`widgets/${env}/tree.json`, { bustCache: true })),
    );

    const previous = treeStore.value.data;
    treeStore.value = {
      data: envsToFetch.reduce(
        (acc, env, index) => {
          return {
            ...acc,
            [env]: data[index],
          };
        },
        { ...previous },
      ),
      loading: false,
      error: undefined,
    };
  } catch (e) {
    treeStore.value = {
      ...treeStore.value,
      error: e.message,
      loading: false,
    };
  }
};
