import { computed, signal } from "@preact/signals";

type NavigateToString = string;
type NavigateToObject = {
  tabName?: string;
  params?: {
    id?: string | null;
    testResultId?: string | null;
  };
};

export const DEFAULT_TAB = "overview";

/**
 * Parses a location hash (with or without the leading "#") into a route.
 * An empty hash opens the default tab, like Allure 2 opens Overview for `index.html`.
 */
export const parseRoute = (hash: string) => {
  const [tabName, ...params] = hash.replace(/^#/, "").split("/");
  return {
    tabName: tabName || DEFAULT_TAB,
    params: { id: params[0] || null, testResultId: params[1] || null },
  };
};

const parseHash = () => parseRoute(globalThis.location?.hash ?? "");

export const route = signal(parseHash());

export const handleHashChange = () => {
  const newRoute = parseHash();

  if (
    newRoute.tabName !== route.value.tabName ||
    newRoute.params.id !== route.value.params.id ||
    newRoute.params.testResultId !== route.value.params.testResultId
  ) {
    route.value = newRoute;
  }
};

export const navigateTo = (path: NavigateToString | NavigateToObject) => {
  let newHash = "";

  if (typeof path === "string") {
    newHash = path.startsWith("#") ? path.slice(1) : path;
  } else {
    const { tabName = DEFAULT_TAB, params = {} } = path;
    const { id = null, testResultId = null } = params;
    newHash = `${tabName}/${id || ""}/${testResultId || ""}`;
  }

  history.pushState(null, "", `#${newHash}`);

  handleHashChange();
};

export const activeTab = computed(() => route.value.tabName);
