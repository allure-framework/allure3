import type { TestStatus, SeverityLevel } from "@allurereport/core-api";

// Константы для статусов тестов
export const TEST_STATUSES: readonly TestStatus[] = ["failed", "broken", "passed", "skipped", "unknown"] as const;

// Константы для уровней важности (включая "not set")
export const SEVERITY_LEVELS: readonly (SeverityLevel | "not set")[] = [
  "not set",
  "trivial",
  "minor",
  "normal",
  "critical",
  "blocker"
] as const;

// Константы для mock данных (основаны на картинке)
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

// Функция для создания данных в формате, подходящем для Nivo Bar Chart
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

