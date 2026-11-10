import { computed, signal } from "@preact/signals";

type NavigateToString = string;
type NavigateToObject = {
  tabName?: string;
  params?: {
    id?: string | null;
    testResultId?: string | null;
    testResultTab?: string | null;
  };
};

export const DEFAULT_TAB = "overview";

/**
 * The page of a single test result opened outside of trees: `#testresult/<testResultId>`
 */
export const TEST_RESULT_PAGE = "testresult";

/**
 * Parses a location hash (with or without the leading "#") into a route.
 * An empty hash opens the default tab, like Allure 2 opens Overview for `index.html`.
 * The tab of the opened test result (history, retries, etc.) goes after the test result id:
 * `#suites/<groupId>/<testResultId>/<tab>` or `#testresult/<testResultId>/<tab>`.
 */
export const parseRoute = (hash: string) => {
  const [tabName, ...params] = hash.replace(/^#/, "").split("/");
  const isTestResultPage = tabName === TEST_RESULT_PAGE;

  return {
    tabName: tabName || DEFAULT_TAB,
    params: {
      id: params[0] || null,
      testResultId: (!isTestResultPage && params[1]) || null,
      testResultTab: params[isTestResultPage ? 1 : 2] || null,
    },
  };
};

const parseHash = () => parseRoute(globalThis.location?.hash ?? "");

export const route = signal(parseHash());

export const handleHashChange = () => {
  const newRoute = parseHash();

  if (
    newRoute.tabName !== route.value.tabName ||
    newRoute.params.id !== route.value.params.id ||
    newRoute.params.testResultId !== route.value.params.testResultId ||
    newRoute.params.testResultTab !== route.value.params.testResultTab
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
    const { id = null, testResultId = null, testResultTab = null } = params;
    newHash = `${tabName}/${id || ""}/${testResultId || ""}${testResultTab ? `/${testResultTab}` : ""}`;
  }

  history.pushState(null, "", `#${newHash}`);

  handleHashChange();
};

export const activeTab = computed(() => route.value.tabName);
