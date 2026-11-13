import type { AllureQualityGateResult } from "../model.js";

type UnknownRecord = Record<string, unknown>;

type NormalizeQualityGateResultOptions = {
  legacyCheckFallbackKey?: string;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringList = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;

const normalizeCurrentResult = (value: UnknownRecord): AllureQualityGateResult | undefined => {
  if (
    (value.status !== "passed" && value.status !== "failed") ||
    typeof value.key !== "string" ||
    !isRecord(value.source)
  ) {
    return undefined;
  }

  const sourceType = value.source.type;

  if (sourceType !== "rule" && sourceType !== "command" && sourceType !== "manual") {
    return undefined;
  }

  if (sourceType === "command" && typeof value.source.command !== "string") {
    return undefined;
  }

  const details = isRecord(value.details) ? value.details : undefined;
  const tags = stringList(value.tags);
  const testResults = stringList(details?.testResults);
  const source: AllureQualityGateResult["source"] =
    sourceType === "command" ? { type: "command", command: value.source.command as string } : { type: sourceType };

  return {
    status: value.status,
    key: value.key,
    ...(typeof value.environment === "string" ? { environment: value.environment } : {}),
    ...(tags ? { tags } : {}),
    source,
    ...(details
      ? {
          details: {
            ...(typeof details.message === "string" ? { message: details.message } : {}),
            ...(Object.hasOwn(details, "expected") ? { expected: details.expected } : {}),
            ...(Object.hasOwn(details, "actual") ? { actual: details.actual } : {}),
            ...(testResults ? { testResults } : {}),
            ...(typeof details.stdout === "string" ? { stdout: details.stdout } : {}),
            ...(typeof details.stderr === "string" ? { stderr: details.stderr } : {}),
          },
        }
      : {}),
  };
};

const normalizeLegacyRuleResult = (value: UnknownRecord): AllureQualityGateResult | undefined => {
  if (typeof value.rule !== "string" || typeof value.success !== "boolean") {
    return undefined;
  }

  const testResults = stringList(value.testResults);

  return {
    status: value.success ? "passed" : "failed",
    key: value.rule,
    ...(typeof value.environment === "string" ? { environment: value.environment } : {}),
    source: { type: "rule" },
    details: {
      ...(typeof value.message === "string" ? { message: value.message } : {}),
      ...(Object.hasOwn(value, "expected") ? { expected: value.expected } : {}),
      ...(Object.hasOwn(value, "actual") ? { actual: value.actual } : {}),
      ...(testResults ? { testResults } : {}),
    },
  };
};

const normalizeLegacyCheckResult = (
  value: UnknownRecord,
  fallbackKey?: string,
): AllureQualityGateResult | undefined => {
  const key = typeof value.name === "string" ? value.name : typeof value.id === "string" ? value.id : fallbackKey;

  if (!key) {
    return undefined;
  }

  const details = isRecord(value.details) ? value.details : {};
  const command = typeof details.command === "string" ? details.command : undefined;
  const message = typeof details.message === "string" ? details.message : undefined;
  const error = typeof details.error === "string" ? details.error : undefined;
  const tags = stringList(value.tags);

  return {
    status: value.status === "passed" ? "passed" : "failed",
    key,
    ...(tags ? { tags } : {}),
    source: command ? { type: "command", command } : { type: "manual" },
    ...(message || error
      ? {
          details: command
            ? {
                ...(message ? { stdout: message } : {}),
                ...(error ? { stderr: error } : {}),
              }
            : {
                ...(message ? { message } : {}),
                ...(error ? { stderr: error } : {}),
              },
        }
      : {}),
  };
};

/**
 * Compatibility bridge for persisted quality gate data.
 * Accepts the current result shape, legacy rule validation results, and deprecated AllureCheckResult records.
 */
export const normalizeQualityGateResult = (
  value: unknown,
  options: NormalizeQualityGateResultOptions = {},
): AllureQualityGateResult | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  return (
    normalizeCurrentResult(value) ??
    normalizeLegacyRuleResult(value) ??
    normalizeLegacyCheckResult(value, options.legacyCheckFallbackKey)
  );
};

export const normalizeQualityGateResults = (value: unknown): AllureQualityGateResult[] => {
  const items = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : [];

  return items.flatMap((item) => {
    const result = normalizeQualityGateResult(item);

    return result ? [result] : [];
  });
};
