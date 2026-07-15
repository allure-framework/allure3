/**
 * Allure 2 parity: https://github.com/allure-framework/allure2/blob/main/Analytics.md
 * Set `ALLURE_NO_ANALYTICS=true` (or `1`) to disable anonymous Google Analytics in reports.
 */
export const ALLURE_NO_ANALYTICS_ENV = "ALLURE_NO_ANALYTICS";

/**
 * Resolves whether report HTML should embed Google Analytics.
 * Environment opt-out always wins; otherwise the plugin option defaults to enabled.
 */
export const isAnalyticsEnabled = (option?: boolean): boolean => {
  const envValue = process.env[ALLURE_NO_ANALYTICS_ENV]?.trim().toLowerCase();

  if (envValue === "true" || envValue === "1") {
    return false;
  }

  return option ?? true;
};
