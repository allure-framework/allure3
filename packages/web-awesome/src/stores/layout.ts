import { getReportOptions } from "@allurereport/web-commons";
import { computed, signal } from "@preact/signals";
import type { AwesomeReportOptions, Layout } from "types";

const reportOptions = getReportOptions<AwesomeReportOptions>();

const DEFAULT_LAYOUT = "base";

const getInitialLayout = (): Layout => {
  if (typeof window === "undefined") {
    return DEFAULT_LAYOUT;
  }

  // Parity with static report: prefer reportOptions.layout over localStorage
  const optsLayout = reportOptions?.layout as Layout | undefined;
  if (optsLayout === "base" || optsLayout === "split") {
    return optsLayout;
  }

  const lsLayout = localStorage.getItem("layout") as Layout | null;
  return lsLayout ?? DEFAULT_LAYOUT;
};

export const layoutStore = signal<Layout>(getInitialLayout());

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
