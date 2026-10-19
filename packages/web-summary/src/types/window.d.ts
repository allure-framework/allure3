import type { ReportSummary } from "@allurereport/web-components";

declare global {
  interface Window {
    reportDataReady: boolean;
    reportData: Record<string, any>;
    reportSummaries?: ReportSummary[];
  }
}

export {};
