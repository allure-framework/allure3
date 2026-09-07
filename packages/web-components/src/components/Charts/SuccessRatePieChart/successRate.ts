export type SuccessRateI18n = (key: string, values?: Record<string, any>) => string;

const messages: Record<string, string> = {
  successRate: "Success rate: {{rate}}",
  successRateDescription: "Calculated from passed, failed, and broken tests. Skipped and unknown tests are excluded.",
  noResults: "There are no test results.",
  noEligibleResults:
    "There are no passed, failed, or broken tests. Skipped and unknown tests are excluded from the success rate.",
  statusSlice: "{{count}} {{status}} ({{percent}}% of all tests)",
  slice: "{{count}} tests ({{percent}}% of all tests)",
  slice_one: "{{count}} test ({{percent}}% of all tests)",
  layer: "Layer: {{layer}}",
};

export const defaultSuccessRateI18n: SuccessRateI18n = (key, values = {}) => {
  if (key.startsWith("status.")) {
    return key.slice(7);
  }

  const template = messages[key === "slice" && values.count === 1 ? "slice_one" : key] ?? key;

  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? ""));
};

export const formatChartPercentage = (percentage: number) => {
  const scaled = percentage * 100;

  return String(Math.floor(scaled + Number.EPSILON * Math.abs(scaled)) / 100);
};

export const successRateDescription = (total: number, eligibleCount: number, i18n: SuccessRateI18n) =>
  i18n(total === 0 ? "noResults" : eligibleCount === 0 ? "noEligibleResults" : "successRateDescription");
