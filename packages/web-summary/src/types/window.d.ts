declare global {
  interface Window {
    reportDataReady: boolean;
    reportData: Record<string, any>;
    // TODO: add the summary type here
    reportSummaries: any;
  }
}

export {};
