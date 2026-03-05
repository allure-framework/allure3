import {
  type TestFixtureResult,
  type TestLabel,
  type TestResult,
  type TestStepResult,
  createDictionary,
} from "@allurereport/core-api";
import type { AwesomeFixtureResult, AwesomeTestResult, AwesomeTestStepResult } from "@allurereport/web-awesome";
import MarkdownIt from "markdown-it";

const md = new MarkdownIt();
const markdownToHtml = (value?: string): string | undefined => (value ? md.render(value) : undefined);

const shouldHideLabel = (labelName: string, matchers: readonly (string | RegExp)[]): boolean => {
  if (labelName.startsWith("_")) {
    return true;
  }

  return matchers.some((matcher) => {
    if (typeof matcher === "string") {
      return matcher === labelName;
    }

    if (matcher.global || matcher.sticky) {
      matcher.lastIndex = 0;
    }

    return matcher.test(labelName);
  });
};

const filterLabels = (labels: TestLabel[], hideLabels: readonly (string | RegExp)[] = []): TestLabel[] => {
  return labels.filter(({ name }) => !shouldHideLabel(name, hideLabels));
};

const mapLabelsByName = (labels: TestLabel[]): Record<string, string[]> => {
  return labels.reduce<Record<string, string[]>>((acc, { name, value }: TestLabel) => {
    acc[name] = acc[name] || [];

    if (value) {
      acc[name].push(value);
    }

    return acc;
  }, createDictionary<string[]>());
};

export const convertTestResult = (
  tr: TestResult,
  options: {
    hideLabels?: readonly (string | RegExp)[];
  } = {},
): AwesomeTestResult => {
  const labels = filterLabels(tr.labels, options.hideLabels);

  return {
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
    hidden: tr.hidden,
    labels,
    groupedLabels: mapLabelsByName(labels),
    parameters: tr.parameters,
    links: tr.links,
    steps: tr.steps,
    error: tr.error,
    testCase: tr.testCase,
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
};

export const convertTestStepResult = (tsr: TestStepResult): AwesomeTestStepResult => {
  return tsr;
};

export const convertFixtureResult = (fr: TestFixtureResult): AwesomeFixtureResult => {
  return {
    id: fr.id,
    type: fr.type,
    name: fr.name,
    status: fr.status,
    steps: fr.steps.map(convertTestStepResult),
    duration: fr.duration,
  };
};
