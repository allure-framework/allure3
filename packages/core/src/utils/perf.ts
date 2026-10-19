import { performance } from "node:perf_hooks";

export const PERF_METRIC_NAMES = {
  allureTotal: "allure.total",
  restoreStateTotal: "restoreState.total",
  restoreStateDump: "restoreState.dump",
  restoreStateAttachments: "restoreState.attachments",
  restoreStateStoreRestore: "restoreState.storeRestore",
  generateTotal: "generate.total",
  generateReadResults: "generate.readResults",
  generateReadResultsXcresultCheck: "generate.readResults.xcresultCheck",
  generateReadResultsReaddir: "generate.readResults.readdir",
  generatePluginsDone: "generate.plugins.done",
  publishUploadTotal: "publish.upload.total",
  summaryGenerate: "summary.generate",
} as const;

export const PERF_METRIC_PREFIXES = {
  generatePlugin: "generate.plugin.",
  generatePluginDone: "generate.plugin.done.",
  publishUploadPlugin: "publish.upload.plugin.",
} as const;

export const isPerfMetricsEnabled = () =>
  ["1", "true", "yes", "on"].includes((process.env.ALLURE_PERF_METRICS ?? "").toLowerCase());

let sequence = 0;

export const startPerfSpan = (name: string): (() => void) => {
  if (!isPerfMetricsEnabled()) {
    return () => {};
  }

  const id = `allure:perf:${sequence++}:${name}`;
  const startMark = `${id}:start`;
  const endMark = `${id}:end`;
  let ended = false;
  performance.mark(startMark);

  return () => {
    if (ended) {
      return;
    }
    ended = true;
    performance.mark(endMark);
    try {
      performance.measure(name, startMark, endMark);
    } finally {
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
    }
  };
};

export const measurePerf = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
  const end = startPerfSpan(name);
  try {
    return await fn();
  } finally {
    end();
  }
};
