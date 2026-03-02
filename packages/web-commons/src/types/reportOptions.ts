/** API-backed report config: when set, report data is fetched from backend instead of static/base href */
export interface AllureReportApiOptions {
  /** Backend base URL without trailing slash (e.g. http://localhost:3000) */
  apiBaseUrl?: string;
  /** Launch id for widgets/trees (passed as query param to backend) */
  launchId?: string;
}
