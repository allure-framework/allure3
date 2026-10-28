import { type Statistic, emptyStatistic, incrementStatistic } from "@allurereport/core-api";
import { errorMessageFromUnknown, fetchReportJsonData, loadFromLocalStorage } from "@allurereport/web-commons";
import { type ReadonlySignal, type Signal, computed, signal } from "@preact/signals";
import type { ReportRecursiveTree, ReportStatus, ReportTree, ReportTreeGroup } from "types";

import type { StoreSignalState } from "@/stores/types";
import { createRecursiveTree, isRecursiveTreeEmpty } from "@/utils/treeFilters";

export type TreeSortBy = "order" | "duration" | "status" | "alphabet";
export type TreeDirection = "asc" | "desc";
export type TreeFilters = "flaky" | "retry" | "new";
export type TreeFiltersState = {
  query: string;
  status: ReportStatus;
  filter: Record<TreeFilters, boolean>;
  sortBy: TreeSortBy;
  direction: TreeDirection;
};

export type TreeId = "suites" | "behaviors" | "packages" | "categories";

/**
 * `default` opens failed and broken groups only (Allure 2 behavior),
 * `expanded` and `collapsed` are set by the "Expand all" and "Collapse all" controls
 */
export type TreeExpansionMode = "default" | "expanded" | "collapsed";

export type TreeExpansionState = {
  mode: TreeExpansionMode;
  /**
   * Incremented on every expand/collapse all command to re-apply the mode to every group
   */
  version: number;
};

export type TreeStore = {
  id: TreeId;
  /**
   * Name of the CSV file the plugin writes to the `data` directory for this tree
   */
  csvFileName: string;
  data: Signal<StoreSignalState<ReportTree>>;
  filters: Signal<TreeFiltersState>;
  filtered: ReadonlySignal<ReportRecursiveTree>;
  /**
   * Status counters of the tests in this tree (each test result is counted once,
   * even when it is placed into several groups). `undefined` until the tree is loaded
   */
  stats: ReadonlySignal<Statistic | undefined>;
  noTests: ReadonlySignal<boolean>;
  noTestsFound: ReadonlySignal<boolean>;
  expansion: Signal<TreeExpansionState>;
  showGroupsInfo: Signal<boolean>;
  fetchData: () => Promise<void>;
  setQuery: (query: string) => void;
  setStatus: (status: ReportStatus) => void;
  setSortBy: (sortBy: TreeSortBy) => void;
  setDirection: (direction: TreeDirection) => void;
  setFilter: (filterKey: TreeFilters, value: boolean) => void;
  clearFilters: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  toggleGroupsInfo: () => void;
};

const sortByValues: TreeSortBy[] = ["order", "duration", "status", "alphabet"];
const directionValues: TreeDirection[] = ["asc", "desc"];

export const defaultTreeFilters = (): TreeFiltersState => ({
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

export const treeSortStorageKey = (id: TreeId) => `allure-classic-tree-sort-${id}`;
export const treeGroupsInfoStorageKey = (id: TreeId) => `allure-classic-tree-groups-info-${id}`;

const saveToLocalStorage = (key: string, value: unknown) => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be unavailable (e.g. blocked site data), the setting just won't persist
  }
};

const restoreSort = (id: TreeId): Pick<TreeFiltersState, "sortBy" | "direction"> => {
  const defaults = defaultTreeFilters();
  const stored = loadFromLocalStorage<Partial<Pick<TreeFiltersState, "sortBy" | "direction">>>(
    treeSortStorageKey(id),
    {},
  );

  return {
    sortBy: sortByValues.includes(stored?.sortBy as TreeSortBy) ? (stored.sortBy as TreeSortBy) : defaults.sortBy,
    direction: directionValues.includes(stored?.direction as TreeDirection)
      ? (stored.direction as TreeDirection)
      : defaults.direction,
  };
};

export const createTreeStore = (options: { id: TreeId; widgetFileName: string; csvFileName: string }): TreeStore => {
  const { id, widgetFileName, csvFileName } = options;
  const data = signal<StoreSignalState<ReportTree>>({
    loading: true,
    error: undefined,
    data: undefined,
  });
  const filters = signal<TreeFiltersState>({
    ...defaultTreeFilters(),
    ...restoreSort(id),
  });
  const expansion = signal<TreeExpansionState>({ mode: "default", version: 0 });
  const showGroupsInfo = signal<boolean>(loadFromLocalStorage<boolean>(treeGroupsInfoStorageKey(id), true) !== false);

  const filtered = computed(() => {
    // The consuming view renders this computed tree only after its Loadable has data.
    const { root, leavesById, groupsById } = data.value.data!;

    return createRecursiveTree({
      group: root as ReportTreeGroup,
      leavesById,
      groupsById,
      filterOptions: filters.value,
    });
  });
  const stats = computed(() => {
    const leavesById = data.value?.data?.leavesById;

    if (!leavesById) {
      return undefined;
    }

    const statistic = emptyStatistic();

    Object.values(leavesById).forEach(({ status }) => incrementStatistic(statistic, status));

    return statistic;
  });
  const noTests = computed(() => !Object.keys(data.value?.data?.leavesById ?? {}).length);
  const noTestsFound = computed(() => isRecursiveTreeEmpty(filtered.value));

  const update = (patch: Partial<TreeFiltersState>) => {
    filters.value = { ...filters.value, ...patch };
  };
  const updateSort = (patch: Partial<Pick<TreeFiltersState, "sortBy" | "direction">>) => {
    update(patch);
    saveToLocalStorage(treeSortStorageKey(id), { sortBy: filters.value.sortBy, direction: filters.value.direction });
  };
  const setExpansion = (mode: TreeExpansionMode) => {
    expansion.value = { mode, version: expansion.value.version + 1 };
  };

  return {
    id,
    csvFileName,
    data,
    filters,
    filtered,
    stats,
    noTests,
    noTestsFound,
    expansion,
    showGroupsInfo,
    fetchData: async () => {
      data.value = {
        ...data.value,
        loading: true,
        error: undefined,
      };

      try {
        const res = await fetchReportJsonData<ReportTree>(`widgets/${widgetFileName}`, { bustCache: true });

        data.value = {
          data: res,
          error: undefined,
          loading: false,
        };
      } catch (e) {
        data.value = {
          ...data.value,
          error: errorMessageFromUnknown(e),
          loading: false,
        };
      }
    },
    setQuery: (query) => update({ query }),
    setStatus: (status) => update({ status }),
    setSortBy: (sortBy) => updateSort({ sortBy }),
    setDirection: (direction) => updateSort({ direction }),
    setFilter: (filterKey, value) => update({ filter: { ...filters.value.filter, [filterKey]: value } }),
    // the sorting is a persisted preference, so it's kept when filters are cleared
    clearFilters: () => {
      const { sortBy, direction } = filters.value;

      filters.value = { ...defaultTreeFilters(), sortBy, direction };
    },
    expandAll: () => setExpansion("expanded"),
    collapseAll: () => setExpansion("collapsed"),
    toggleGroupsInfo: () => {
      showGroupsInfo.value = !showGroupsInfo.value;
      saveToLocalStorage(treeGroupsInfoStorageKey(id), showGroupsInfo.value);
    },
  };
};

export const suitesTree = createTreeStore({ id: "suites", widgetFileName: "tree.json", csvFileName: "suites.csv" });
export const behaviorsTree = createTreeStore({
  id: "behaviors",
  widgetFileName: "behaviors.json",
  csvFileName: "behaviors.csv",
});
export const packagesTree = createTreeStore({
  id: "packages",
  widgetFileName: "packages.json",
  csvFileName: "packages.csv",
});
export const categoriesTree = createTreeStore({
  id: "categories",
  widgetFileName: "categories.json",
  csvFileName: "categories.csv",
});
