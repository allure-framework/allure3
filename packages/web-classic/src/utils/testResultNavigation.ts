export type TestResultRoute = {
  tabName?: string;
  params: { id?: string | null; testResultId?: string | null; testResultTab?: string | null };
};

const DEFAULT_TEST_RESULT_TAB = "overview";

/**
 * Builds the hash of another test result in the same context: tree pages (suites, behaviors, etc.)
 * keep their tab and parent node, the standalone test result page keeps the `testresult/<id>` route.
 * The tab of the test result (history, retries, etc.) is kept too, the overview tab is left out of the hash.
 */
export const getTestResultHash = (
  route: TestResultRoute,
  testResultId: string,
  testResultTab: string | null | undefined = route.params.testResultTab,
) => {
  const { tabName, params } = route;
  const tabSuffix = testResultTab && testResultTab !== DEFAULT_TEST_RESULT_TAB ? `/${testResultTab}` : "";

  if (tabName && tabName !== "testresult" && params.testResultId) {
    return `${tabName}/${params.id || "root"}/${testResultId}${tabSuffix}`;
  }

  return `testresult/${testResultId}${tabSuffix}`;
};

/**
 * Builds the hash of the current test result opened on another tab.
 */
export const getTestResultTabHash = (route: TestResultRoute, testResultTab: string) => {
  const { tabName, params } = route;
  const testResultId = tabName === "testresult" ? params.id : params.testResultId;

  return testResultId ? getTestResultHash(route, testResultId, testResultTab) : undefined;
};

/**
 * Returns ids of the previous and the next test results in the navigation list.
 */
export const getAdjacentTestResultIds = (ids: string[], currentId: string) => {
  const index = ids.indexOf(currentId);

  if (index === -1) {
    return { prevId: undefined, nextId: undefined, position: 0 };
  }

  return {
    prevId: index > 0 ? ids[index - 1] : undefined,
    nextId: index < ids.length - 1 ? ids[index + 1] : undefined,
    position: index + 1,
  };
};
