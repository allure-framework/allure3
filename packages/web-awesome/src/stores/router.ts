import { createRoute, navigateTo as routerNavigateTo } from "@allurereport/web-commons";
import { computed } from "@preact/signals";

export const navigateToTestResult = (params: { testResultId: string; tab?: string }) => {
  routerNavigateTo({ path: "/:testResultId/:tab?", params, keepSearchParams: true });
};

export const navigateToTestResultTab = (params: { testResultId: string; tab: string }) => {
  routerNavigateTo({ path: "/:testResultId/:tab?", params, keepSearchParams: true, replace: true });
};

export const navigateToRoot = () => {
  routerNavigateTo({ path: "/", keepSearchParams: true });
};

export const navigateToSection = (params: { section: "timeline" | "charts" }) => {
  routerNavigateTo({ path: "/:section", params, keepSearchParams: true, replace: false });
};

const sections = ["charts", "timeline"];

export const testResultRoute = computed(() =>
  createRoute<{ testResultId: string; tab?: string }>("/:testResultId/:tab?", ({ params }) => {
    return params.testResultId && !sections.includes(params.testResultId);
  }),
);

export const rootRoute = computed(() => createRoute<{}>("/"));

export const sectionRoute = computed(() =>
  createRoute<{ section: "timeline" | "charts" }>("/:section", ({ params }) => {
    return sections.includes(params.section);
  }),
);

export const openInNewTab = (path: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.open(`#${path}`, "_blank");
};
