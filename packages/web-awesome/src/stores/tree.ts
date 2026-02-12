import { buildFilterPredicate, fetchReportJsonData } from "@allurereport/web-commons";
import type { RecursiveTree } from "@allurereport/web-components/global";
import { computed, effect, signal } from "@preact/signals";
import type { AwesomeTree, AwesomeTreeGroup } from "types";
import type { StoreSignalState } from "@/stores/types";
import { loadFromLocalStorage } from "@/utils/loadFromLocalStorage";
import { createRecursiveTree, isRecursiveTreeEmpty } from "@/utils/treeFilters";
import { treeFilters } from "./treeFilters/store";
import { sortBy } from "./treeSort";

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

export const fetchEnvTreesData = async (envs: string[]) => {
  const envsToFetch = envs.filter((env) => !treeStore.peek().data?.[env]);

  // all envs have already been fetched
  if (envsToFetch.length === 0) {
    return;
  }

  treeStore.value = {
    ...treeStore.peek(),
    loading: true,
    error: undefined,
  };

  try {
    const data = await Promise.all(
      envsToFetch.map((env) => fetchReportJsonData<AwesomeTree>(`widgets/${env}/tree.json`, { bustCache: true })),
    );

    const previous = treeStore.peek().data;
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
      ...treeStore.peek(),
      error: e.message,
      loading: false,
    };
  }
};

const treeEntries = computed(() => (treeStore.value.data ? Object.entries(treeStore.value.data) : []));

const alwaysTruePredicate = () => true;

const filterPredicate = computed(() => {
  if (treeFilters.value.length === 0) {
    return alwaysTruePredicate;
  }

  return buildFilterPredicate(treeFilters.value);
});

export const filteredTree = computed(() => {
  return treeEntries.value.reduce(
    (acc, [key, value]) => {
      if (!value) {
        return acc;
      }

      const { root, leavesById, groupsById } = value;

      const tree = createRecursiveTree({
        group: root as AwesomeTreeGroup,
        leavesById,
        groupsById,
        filterPredicate: filterPredicate.value,
        sortBy: sortBy.value,
      });

      return Object.assign(acc, {
        [key]: tree,
      });
    },
    {} as Record<string, RecursiveTree>,
  );
});

export const noTestsFound = computed(
  () => !Object.values(filteredTree.value).some((tree) => !isRecursiveTreeEmpty(tree)),
);
