declare global {
  interface Window {
    reportDataReady: boolean;
    reportData: Record<string, any>;
  }
}

export {};
