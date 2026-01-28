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

export const fetchCategoriesData = async () => {
  categoriesStore.value = {
    ...categoriesStore.value,
    loading: true,
    error: undefined,
  };

  try {
    const res = await fetchReportJsonData<TestCategories>("widgets/categories.json");

    categoriesStore.value = {
      data: res,
      error: undefined,
      loading: false,
    };
  } catch (e) {
    categoriesStore.value = {
      ...categoriesStore.value,
      error: e.message,
      loading: false,
    };
  }
};
