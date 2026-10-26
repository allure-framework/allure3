import type { HistoryTestResult, HistoryTestResultUrlResolver } from "@allurereport/core-api";

/**
 * Resolves the link of a historical test result to the classic report it was produced by.
 * The history resolver points at the report page with the result id as the hash, while classic
 * opens a test result by the `#testresult/<id>` route. Returns an empty string when the link cannot be resolved.
 */
export const resolveClassicHistoryUrl = (
  item: Pick<HistoryTestResult, "id" | "url">,
  pluginId: string,
  resolveHistoryUrl?: HistoryTestResultUrlResolver,
): string => {
  if (!item.url || !resolveHistoryUrl) {
    return "";
  }

  let resolved: string;

  try {
    resolved = resolveHistoryUrl(item.url, pluginId, item.id);
  } catch {
    return "";
  }

  if (!resolved) {
    return "";
  }

  try {
    const url = new URL(resolved);

    url.hash = `testresult/${item.id}`;

    return url.toString();
  } catch {
    return "";
  }
};
