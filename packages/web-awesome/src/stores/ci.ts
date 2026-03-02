import type { CiDescriptor } from "@allurereport/core-api";
import { fetchReportJsonData } from "@allurereport/web-commons";

/**
 * Fetches CI descriptor from backend and merges into allureReportOptions for CiInfo.
 * No-op when launchId is missing or fetch fails.
 */
export const fetchCi = async (): Promise<void> => {
  try {
    const ci = await fetchReportJsonData<CiDescriptor | null>("widgets/ci.json", {
      bustCache: true,
    });
    if (ci && typeof globalThis.allureReportOptions !== "undefined") {
      globalThis.allureReportOptions = {
        ...globalThis.allureReportOptions,
        ci,
      };
    }
  } catch {
    // No launchId, static mode, or API error — leave allureReportOptions unchanged
  }
};
