declare global {
  interface Window {
    reportDataReady: boolean;
    reportData: Record<string, any>;
    __allureLiveReload?: () => void | Promise<void>;
  }
}

export {};
