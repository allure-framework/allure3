import { getReportOptions } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import type { AllureAwesomeReportOptions } from "../../types.js";

type Layout = "base" | "split";

const { layout } = getReportOptions<AllureAwesomeReportOptions>() ?? {};

export const layoutStore = signal<Layout>("base");
export const isLayoutLoading = signal(false);

export const setLayout = (newTheme: Layout): void => {
  layoutStore.value = newTheme;
  document.documentElement.setAttribute("data-layout", newTheme);
  window.localStorage.setItem("layout", newTheme);
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
