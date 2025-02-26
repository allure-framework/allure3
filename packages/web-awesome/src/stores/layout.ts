import { getReportOptions } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import type { AllureAwesomeReportOptions, Layout } from "types";

const { layout } = getReportOptions<AllureAwesomeReportOptions>() ?? {};

export const layoutStore = signal<Layout>("base");
export const isLayoutLoading = signal(false);

export const setLayout = (newLayout: Layout): void => {
  layoutStore.value = newLayout;
  document.documentElement.setAttribute("data-layout", newLayout as string);
  window.localStorage.setItem("layout", newLayout as string);
};

export const toggleLayout = () => {
  isLayoutLoading.value = true;

  setTimeout(() => {
    setLayout(layoutStore.value === "base" ? "split" : "base");

    setTimeout(() => {
      isLayoutLoading.value = false;
    }, 300);
  }, 200);
};

export const isSplitMode = computed(() => layoutStore.value === "split");

export const getLayout = () => {
  const layoutFromLS = (window.localStorage.getItem("layout") as Layout | null) || (layout as Layout);

  if (layoutFromLS) {
    setLayout(layoutFromLS);
    return;
  }
};
