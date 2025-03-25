import { createRoute, navigateTo as routerNavigateTo } from "@allurereport/web-commons";
import { computed } from "@preact/signals";

const normalizeTab = (tab?: string) => (tab && tab !== "overview" ? tab : undefined);

export const navigateToTestResult = (params: { testResultId: string; tab?: string }) => {
  const normalized = { ...params, tab: normalizeTab(params.tab) };
  const path = rootTabRoute.value.matches ? "/:rootTab/:testResultId/:tab?" : "/:testResultId/:tab?";
  const routeParams = rootTabRoute.value.matches
    ? { ...normalized, rootTab: rootTabRoute.value.params.rootTab }
    : normalized;
  routerNavigateTo({ path, params: routeParams, keepSearchParams: true });
};

export const navigateToPlainTestResult = (params: { testResultId: string; tab?: string }) => {
  const normalized = { ...params, tab: normalizeTab(params.tab) };
  routerNavigateTo({ path: "/:testResultId/:tab?", params: normalized, keepSearchParams: true });
};

export const navigateToTestResultTab = (params: { testResultId: string; tab: string }) => {
  const normalized = { ...params, tab: normalizeTab(params.tab) };
  const path = rootTabRoute.value.matches ? "/:rootTab/:testResultId/:tab?" : "/:testResultId/:tab?";
  const routeParams = rootTabRoute.value.matches
    ? { ...normalized, rootTab: rootTabRoute.value.params.rootTab }
    : normalized;
  routerNavigateTo({ path, params: routeParams, keepSearchParams: true, replace: true });
};

export const navigateToRoot = () => {
  routerNavigateTo({ path: "/", keepSearchParams: true });
};

export const navigateToCategoriesRoot = () => {
  routerNavigateTo({ path: "/categories", keepSearchParams: true });
};

export const navigateToCategoriesTestResult = (params: { testResultId: string; tab?: string }) => {
  const normalized = { ...params, tab: normalizeTab(params.tab) };
  routerNavigateTo({ path: "/categories/:testResultId/:tab?", params: normalized, keepSearchParams: true });
};

export const navigateToRootTabRoot = (params: { rootTab: string }) => {
  routerNavigateTo({ path: "/:rootTab", params, keepSearchParams: true });
};

export const navigateToRootTabTestResult = (params: { rootTab: string; testResultId: string; tab?: string }) => {
  const normalized = { ...params, tab: normalizeTab(params.tab) };
  routerNavigateTo({ path: "/:rootTab/:testResultId/:tab?", params: normalized, keepSearchParams: true });
};

export const navigateToSection = (params: { section: "timeline" | "charts" }) => {
  routerNavigateTo({ path: "/:section", params, keepSearchParams: true, replace: false });
};

const sections = ["charts", "timeline"];
const rootTabs = ["categories", "qualityGate", "globalAttachments", "globalErrors"];

export const rootTabRoute = computed(() =>
  createRoute<{ rootTab: string; testResultId?: string; tab?: string }>(
    "/:rootTab/:testResultId?/:tab?",
    ({ params }) => rootTabs.includes(params.rootTab) && params.rootTab !== params.testResultId,
  ),
);

export const categoriesRoute = computed(() =>
  createRoute<{ testResultId?: string; tab?: string }>("/categories/:testResultId?/:tab?"),
);

export const testResultRoute = computed(() =>
  createRoute<{ testResultId: string; tab?: string }>("/:testResultId/:tab?", ({ params }) => {
    return (
      params.testResultId &&
      params.testResultId !== "categories" &&
      !sections.includes(params.testResultId) &&
      !rootTabs.includes(params.testResultId)
    );
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
