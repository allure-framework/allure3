import type { TestStatus, SeverityLevel } from "@allurereport/core-api";

// Test status constants
export const TEST_STATUSES: readonly TestStatus[] = ["failed", "broken", "passed", "skipped", "unknown"] as const;

// Severity level constants (including "not set")
export const SEVERITY_LEVELS: readonly (SeverityLevel | "not set")[] = [
  "not set",
  "trivial",
  "minor",
  "normal",
  "critical",
  "blocker"
] as const;

// Mock data constants (based on the image)
export const MOCK_DATA_BY_SEVERITY: Record<SeverityLevel | "not set", Record<TestStatus, number>> = {
  "not set": {
    failed: 2,
    broken: 4,
    passed: 68,
    skipped: 6,
    unknown: 4,
  },
  "trivial": {
    failed: 8,
    broken: 10,
    passed: 95,
    skipped: 7,
    unknown: 6,
  },
  "minor": {
    failed: 7,
    broken: 6,
    passed: 58,
    skipped: 3,
    unknown: 5,
  },
  "normal": {
    failed: 10,
    broken: 2,
    passed: 88,
    skipped: 6,
    unknown: 6,
  },
  "critical": {
    failed: 10,
    broken: 2,
    passed: 88,
    skipped: 6,
    unknown: 6,
  },
  "blocker": {
    failed: 8,
    broken: 6,
    passed: 78,
    skipped: 6,
    unknown: 6,
  },
};

// Function to create data in format suitable for Nivo Bar Chart
export const createBarChartData = () => {
  return SEVERITY_LEVELS.map(severity => {
    const dataPoint: Record<string, string | number> = {
      severity: severity === "not set" ? "not set" : severity,
    };

    TEST_STATUSES.forEach(status => {
      dataPoint[status] = MOCK_DATA_BY_SEVERITY[severity][status];
    });

    return dataPoint;
  });
};

export const TREND_CATEGORIES = ["fixed", "failed", "broken"] as const;
export type TrendCategory = typeof TREND_CATEGORIES[number];

export const TREND_DATA_POINTS: Record<TrendCategory, number[]> = {
  fixed: [3, 1, 4, 4, 4.5, 3, 3, 0, 1],
  failed: [0, -1, -0.5, 0, -1.5, -1, -1, -1, -1],
  broken: [-3, -7, 0, 0, -3.5, -3, -7, -2.5, -2.5],
};

export const createTrendBarChartData = () => {
  return TREND_DATA_POINTS.fixed.map((_, index) => {
    const dataPoint: Record<string, string | number> = {
      point: `Point ${index + 1}`,
    };

    TREND_CATEGORIES.forEach(category => {
      dataPoint[category] = TREND_DATA_POINTS[category][index];
    });

    return dataPoint;
  });
};

export const trendColors: Record<TrendCategory, string> = {
  fixed: "#4CAF50",
  failed: "#F44336",
  broken: "#FFC107",
};

