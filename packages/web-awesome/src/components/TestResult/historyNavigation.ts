export const getHistoryNavigationUrl = (
  url: string | undefined,
  reportId: string,
  testResultId: string,
): string | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    const navUrl = new URL(url);
    const pathname = navUrl.pathname.endsWith("/") ? navUrl.pathname : `${navUrl.pathname}/`;
    const lastSegment = pathname.slice(0, -1).split("/").pop();

    navUrl.pathname = lastSegment === reportId ? pathname : `${pathname}${reportId}/`;
    navUrl.hash = testResultId;

    return navUrl.toString();
  } catch {
    return undefined;
  }
};
