import type { TestCategories } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
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
