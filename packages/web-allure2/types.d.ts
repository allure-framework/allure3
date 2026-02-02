export type Allure2ReportOptions = {
  reportName?: string;
  reportLanguage?: string;
  createdAt: number;
  /**
   * Base URL for shared report store assets (e.g. `data/attachments/*`).
   * Useful when the UI is served from a plugin subdirectory.
   */
  storeBaseUrl?: string;
}
