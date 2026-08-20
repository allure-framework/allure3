import type { AllurePerformanceResult } from "@allurereport/core-api";
import type { RawGlobals, ResultsReader } from "@allurereport/reader-api";

const readerId = "perf";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSupportedFile = (fileName: string) => fileName === "performance.json" || fileName.endsWith("-perf.json");

const finiteNumber = (value: unknown): number | undefined => (Number.isFinite(value) ? Number(value) : undefined);

const normalizePerformanceResult = (result: Record<string, unknown>): AllurePerformanceResult | undefined => {
  const id = typeof result.id === "string" ? result.id.trim() : "";
  const key = typeof result.key === "string" ? result.key.trim() : "";
  const value = finiteNumber(result.value);

  if (!id || !key || value === undefined) {
    return undefined;
  }

  const start = finiteNumber(result.start) ?? 0;
  const stop = finiteNumber(result.stop) ?? start;

  return {
    id,
    key,
    value,
    start,
    stop,
  };
};

const performanceResults = (payload: unknown): AllurePerformanceResult[] => {
  const results = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.results)
      ? payload.results
      : isRecord(payload)
        ? [payload]
        : [];

  return results
    .filter(isRecord)
    .map(normalizePerformanceResult)
    .filter((result): result is AllurePerformanceResult => Boolean(result));
};

const rawAttachmentGlobals = (data: {
  getOriginalFileName: () => string;
  getContentType: () => string | undefined;
}): RawGlobals => {
  const originalFileName = data.getOriginalFileName();

  return {
    errors: [],
    attachments: [
      {
        type: "attachment",
        name: originalFileName,
        originalFileName,
        contentType: data.getContentType() ?? "application/json",
      },
    ],
  };
};

export const perf: ResultsReader = {
  matches: (data) => isSupportedFile(data.getOriginalFileName()),
  read: async (visitor, data) => {
    const originalFileName = data.getOriginalFileName();
    const results = performanceResults(await data.asJson<unknown>());

    if (results.length === 0) {
      return false;
    }

    await visitor.visitAttachmentFile(data, { readerId });
    await visitor.visitGlobals(rawAttachmentGlobals(data), { readerId });
    await visitor.visitMetrics(results, { readerId, metadata: { originalFileName } });

    return true;
  },
  readerId: () => readerId,
};
