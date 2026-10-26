export type TestResultRoute = {
  tabName?: string;
  params: { id?: string | null; testResultId?: string | null };
};

/**
 * Builds the hash of another test result in the same context: tree pages (suites, behaviors, etc.)
 * keep their tab and parent node, the standalone test result page keeps the `testresult/<id>` route.
 */
export const getTestResultHash = (route: TestResultRoute, testResultId: string) => {
  const { tabName, params } = route;

  if (tabName && tabName !== "testresult" && params.testResultId) {
    return `${tabName}/${params.id || "root"}/${testResultId}`;
  }

  return `testresult/${testResultId}`;
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
