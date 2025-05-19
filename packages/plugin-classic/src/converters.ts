import type { TestFixtureResult, TestLabel, TestResult, TestStepResult } from "@allurereport/core-api";
import type { AwesomeFixtureResult, AwesomeTestResult, AwesomeTestStepResult } from "@allurereport/web-awesome";

const mapLabelsByName = (labels: TestLabel[]): Record<string, string[]> => {
  return labels.reduce<Record<string, string[]>>((acc, { name, value }: TestLabel) => {
    acc[name] = acc[name] || [];

    if (value) {
      acc[name].push(value);
    }

    return acc;
  }, {});
};

export const convertTestResult = (tr: TestResult): AwesomeTestResult => {
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
    setup: [],
    teardown: [],
    history: [],
    retries: [],
    breadcrumbs: [],
    retry: false,
    new: tr.new,
    newFrom: tr.newFrom
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
