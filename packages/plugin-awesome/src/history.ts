export const buildServiceHistoryUrl = (historyUrl: string, pluginId: string, historicalResultId: string): string => {
  if (!historyUrl) {
    return "";
  }

  const { origin, pathname } = new URL(historyUrl);
  const navigateUrl = new URL([pathname, pluginId].join("/"), origin);
  navigateUrl.hash = historicalResultId;

  return navigateUrl.toString();
};
