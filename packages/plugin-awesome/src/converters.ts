import {
  type TestFixtureResult,
  type TestLabel,
  type TestResult,
  type TestStepResult,
  createDictionary,
  isStep,
  redactParameters,
  shouldHideLabel,
} from "@allurereport/core-api";
import type { ReportFixtureResult, ReportTestResult, ReportTestStepResult } from "@allurereport/plugin-api";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt();
const markdownToHtml = (value?: string): string | undefined => (value ? md.render(value) : undefined);

const mapLabelsByName = (labels: TestLabel[]): Record<string, string[]> => {
  return labels.reduce<Record<string, string[]>>((acc, { name, value }: TestLabel) => {
    acc[name] = acc[name] || [];

    if (value) {
      acc[name].push(value);
    }

    return acc;
  }, createDictionary<string[]>());
};

/**
 * Turns an existing property into one that is computed on every read.
 *
 * `JSON.stringify` and spreads read it like a plain property, in its original position, so the
 * serialised output is unchanged; nothing is kept between reads. Assigning to it stores the
 * value as a plain property again.
 */
export const lazyProperty = <T extends object, K extends keyof T>(target: T, key: K, compute: () => T[K]) => {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: compute,
    set(value: T[K]) {
      Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true });
    },
  });
};

export const convertTestResult = (
  tr: TestResult,
  options: {
    hideLabels?: readonly (string | RegExp)[];
    /**
     * Convert steps when they are read rather than up front, so a report with millions of steps
     * doesn't hold a converted copy of every step tree while it is being generated.
     */
    lazySteps?: boolean;
  } = {},
): ReportTestResult => {
  const labels = tr.labels.filter(({ name }) => !shouldHideLabel(name, options.hideLabels));
  const convertSteps = () => (tr.steps ?? []).map(convertTestStepResult);
  const result: ReportTestResult = {
    id: tr.id,
    name: tr.name,
    start: tr.start,
    stop: tr.stop,
    duration: tr.duration,
    status: tr.status,
    fullName: tr.fullName,
    historyId: tr.historyId,
    flaky: tr.flaky,
    muted: tr.muted,
    known: tr.known,
    resolution: tr.resolution,
    resolutionComment: tr.resolutionComment,
    isRetry: tr.isRetry,
    labels,
    groupedLabels: mapLabelsByName(labels),
    parameters: redactParameters(tr.parameters),
    links: tr.links,
    steps: options.lazySteps ? [] : convertSteps(),
    error: tr.error,
    testCase: tr.testCase,
    retryHash: tr.retryHash,
    descriptionHtml: tr.descriptionHtml ?? markdownToHtml(tr.description),
    environment: tr.environment,
    setup: [],
    teardown: [],
    history: [],
    retries: [],
    breadcrumbs: [],
    retry: false,
    transition: tr.transition,
    titlePath: tr.titlePath || [],
  };

  if (options.lazySteps) {
    lazyProperty(result, "steps", convertSteps);
  }

  return result;
};

export const convertTestStepResult = (tsr: TestStepResult): ReportTestStepResult => {
  if (isStep(tsr)) {
    return {
      ...tsr,
      parameters: redactParameters(tsr.parameters),
      steps: (tsr.steps ?? []).map(convertTestStepResult),
    };
  }

  return tsr;
};

export const convertFixtureResult = (fr: TestFixtureResult): ReportFixtureResult => {
  return {
    id: fr.id,
    type: fr.type,
    name: fr.name,
    status: fr.status,
    steps: fr.steps.map(convertTestStepResult),
    duration: fr.duration,
  };
};
