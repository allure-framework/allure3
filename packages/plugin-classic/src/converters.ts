import type { TestFixtureResult, TestLabel, TestResult, TestStepResult } from "@allurereport/core-api";
import type { ClassicFixtureResult, ClassicTestResult, ClassicTestStepResult } from "@allurereport/web-classic";
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
  }, {});
};

export const convertTestResult = (tr: TestResult): ClassicTestResult => {
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
    labels: tr.labels,
    groupedLabels: mapLabelsByName(tr.labels),
    parameters: tr.parameters,
    links: tr.links,
    steps: tr.steps,
    error: tr.error,
    testCase: tr.testCase,
    descriptionHtml: tr.descriptionHtml ?? markdownToHtml(tr.description),
    setup: [],
    teardown: [],
    history: [],
    retries: [],
    breadcrumbs: [],
    retry: false,
    transition: tr.transition,
  };
};

export const convertTestStepResult = (tsr: TestStepResult): ClassicTestStepResult => {
  return tsr;
};

export const convertFixtureResult = (fr: TestFixtureResult): ClassicFixtureResult => {
  return {
    id: fr.id,
    type: fr.type,
    name: fr.name,
    status: fr.status,
    steps: fr.steps.map(convertTestStepResult),
    duration: fr.duration,
  };
};
