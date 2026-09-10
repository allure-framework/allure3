export const getHistoryNavigationUrl = (url: string | undefined, testResultId: string): string | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    const navUrl = new URL(url);

    navUrl.pathname = navUrl.pathname.endsWith("/") ? navUrl.pathname : `${navUrl.pathname}/`;
    navUrl.hash = testResultId;

    return navUrl.toString();
  } catch {
    return undefined;
  }
};
