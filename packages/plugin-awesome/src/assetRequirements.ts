import type { TestError, TestStepResult } from "@allurereport/core-api";
import type { PluginGlobals, ReportTestResult } from "@allurereport/plugin-api";
import { attachmentAssetFeatures, attachmentType, hasErrorDiff } from "@allurereport/web-commons";

export const collectViewerAssetFeatures = (
  tests: readonly ReportTestResult[],
  attachments: readonly { contentType?: string }[],
  globals: PluginGlobals,
): string[] => {
  const features = new Set<string>();
  const attachment = (link: { contentType?: string }) => {
    const type = attachmentType(link.contentType);
    if (type) for (const feature of attachmentAssetFeatures[type]) features.add(feature);
  };
  const error = (value?: TestError) => {
    if (hasErrorDiff(value)) features.add("error-diff");
  };
  const body = (value: { error?: TestError; errors?: TestError[]; steps?: TestStepResult[] }) => {
    error(value.error);
    value.errors?.forEach(error);
    const steps = [...(value.steps ?? [])];
    while (steps.length) {
      const step = steps.pop()!;
      if (step.type === "attachment") attachment(step.link);
      else {
        error(step.error);
        steps.push(...step.steps);
      }
    }
  };
  for (const test of tests) {
    body(test);
    test.attachments?.forEach((item) => attachment(item.link));
    test.setup.forEach(body);
    test.teardown.forEach(body);
    test.retries?.forEach(body);
    test.history.forEach((item) => error(item.error));
  }
  attachments.forEach(attachment);
  globals.attachments.forEach(attachment);
  Object.values(globals.attachmentsByEnv ?? {})
    .flat()
    .forEach(attachment);
  globals.errors.forEach(error);
  Object.values(globals.errorsByEnv ?? {})
    .flat()
    .forEach(error);
  return [...features].sort();
};
