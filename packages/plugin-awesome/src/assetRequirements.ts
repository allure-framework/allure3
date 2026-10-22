import type { TestError, TestStepResult } from "@allurereport/core-api";
import type { PluginGlobals, ReportTestResult } from "@allurereport/plugin-api";
import { attachmentAssetFeatures, attachmentType, hasErrorDiff } from "@allurereport/web-commons";

export const collectViewerAssetFeatures = (
  tests: readonly ReportTestResult[],
  attachments: readonly { contentType?: string }[],
  globals: PluginGlobals,
): string[] => {
  const features = new Set<string>();
  const collectAttachment = (link: { contentType?: string }) => {
    const type = attachmentType(link.contentType);
    if (type) for (const feature of attachmentAssetFeatures[type]) features.add(feature);
  };
  const collectError = (value?: TestError) => {
    if (hasErrorDiff(value)) features.add("error-diff");
  };
  const collectBody = (value: { error?: TestError; errors?: TestError[]; steps?: TestStepResult[] }) => {
    collectError(value.error);
    value.errors?.forEach(collectError);
    const steps = [...(value.steps ?? [])];
    while (steps.length) {
      const step = steps.pop()!;
      if (step.type === "attachment") collectAttachment(step.link);
      else {
        collectError(step.error);
        steps.push(...step.steps);
      }
    }
  };
  // Inspect emitted results, including fixtures, retries and embedded historical errors.
  for (const test of tests) {
    collectBody(test);
    test.attachments?.forEach((item) => collectAttachment(item.link));
    test.setup.forEach(collectBody);
    test.teardown.forEach(collectBody);
    test.retries?.forEach(collectBody);
    test.history.forEach((item) => collectError(item.error));
  }
  // The complete attachment inventory conservatively covers links outside the filtered test tree.
  attachments.forEach(collectAttachment);
  globals.attachments.forEach(collectAttachment);
  Object.values(globals.attachmentsByEnv ?? {})
    .flat()
    .forEach(collectAttachment);
  globals.errors.forEach(collectError);
  Object.values(globals.errorsByEnv ?? {})
    .flat()
    .forEach(collectError);
  return [...features].sort();
};
