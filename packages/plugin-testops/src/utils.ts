import { env } from "node:process";

import { AllureStore } from "@allurereport/plugin-api";
import type { CategoryDefinition, CategoryGroupSelector, TestResult, TestStepResult } from "@allurereport/core-api";
import { EMPTY_VALUE, extractErrorMatchingData, findLastByLabelName, matchCategory } from "@allurereport/core-api";

import type {  TestResultWithCategories, UploadCategory } from "./model.js";

import type {
  AttachmentForUpload,
  AttachmentsResolver,
  FixtureResolver,
  TestOpsFixtureResult,
  TestOpsPluginOptions,
} from "./model.js";

export const unwrapStepsAttachments = (steps: TestStepResult[]): TestStepResult[] => {
  return steps.map((step) => {
    if (step.type === "attachment") {
      return {
        ...step,
        attachment: step.link,
      };
    }

    if (step.steps) {
      return {
        ...step,
        steps: unwrapStepsAttachments(step.steps),
      };
    }

    return step;
  });
};

export const resolvePluginOptions = (options: TestOpsPluginOptions): Omit<TestOpsPluginOptions, "filter"> => {
  const { ALLURE_TOKEN, ALLURE_ENDPOINT, ALLURE_PROJECT_ID, ALLURE_LAUNCH_TAGS, ALLURE_LAUNCH_NAME } = env;
  const {
    accessToken = ALLURE_TOKEN,
    endpoint = ALLURE_ENDPOINT,
    projectId = ALLURE_PROJECT_ID,
    launchTags = ALLURE_LAUNCH_TAGS,
    launchName = ALLURE_LAUNCH_NAME,
    autocloseLaunch,
  } = options;
  const tags = !launchTags
    ? []
    : Array.isArray(launchTags)
      ? launchTags
      : launchTags.split(",").map((tag) => tag.trim());

  return {
    launchName: launchName || "Allure Report",
    launchTags: tags,
    accessToken: accessToken || "",
    endpoint: endpoint || "",
    projectId: projectId || "",
    ...(autocloseLaunch !== undefined ? { autocloseLaunch } : {}),
  };
};

const formatGroupName = (key: string, value: string) => `${key}: ${value === EMPTY_VALUE ? `No ${key}` : value}`;

const groupValue = (
  selector: CategoryGroupSelector,
  tr: Pick<TestResult, "status" | "labels" | "flaky" | "transition" | "environment">,
): { key: string; value: string; name: string } => {
  const labels = tr.labels ?? [];

  if (selector === "flaky") {
    const value = tr.flaky ? "true" : "false";
    return { key: "flaky", value, name: formatGroupName("flaky", value) };
  }

  if (selector === "transition") {
    const value = tr.transition ?? EMPTY_VALUE;
    return { key: "transition", value, name: formatGroupName("transition", value) };
  }

  if (selector === "status") {
    const value = tr.status ?? "unknown";
    return { key: "status", value, name: formatGroupName("status", value) };
  }

  if (selector === "environment") {
    const value = tr.environment?.trim() ? tr.environment : EMPTY_VALUE;
    return { key: "environment", value, name: formatGroupName("environment", value) };
  }

  if (selector === "owner") {
    const value = findLastByLabelName(labels, "owner") ?? EMPTY_VALUE;
    return { key: "owner", value, name: formatGroupName("owner", value) };
  }

  if (selector === "severity") {
    const value = findLastByLabelName(labels, "severity") ?? "normal";
    return { key: "severity", value, name: formatGroupName("severity", value) };
  }

  if (selector === "layer") {
    const value = findLastByLabelName(labels, "layer") ?? EMPTY_VALUE;
    return { key: "layer", value, name: formatGroupName("layer", value) };
  }

  const labelName = selector.label;
  const labelValue = findLastByLabelName(labels, labelName) ?? EMPTY_VALUE;
  return { key: labelName, value: labelValue, name: formatGroupName(labelName, labelValue) };
};

const buildGrouping = (
  tr: Pick<TestResult, "status" | "labels" | "flaky" | "transition" | "environment"> & {
    id?: string;
    name?: string;
    error?: TestResult["error"];
    historyId?: string;
  },
  category: CategoryDefinition,
): UploadCategory["grouping"] => {
  const grouping = category.groupBy?.map((selector) => groupValue(selector, tr)) ?? [];

  if (category.groupByMessage) {
    const messageValue = tr.error?.message?.trim() ? tr.error.message : EMPTY_VALUE;
    grouping.push({
      key: "message",
      value: messageValue,
      name: formatGroupName("message", messageValue),
    });
  }

  if (category.groupEnvironments) {
    const historyValue = tr.historyId ?? tr.id ?? EMPTY_VALUE;
    const historyName = tr.name?.trim() ? tr.name : historyValue;
    grouping.push({
      key: "historyId",
      value: historyValue,
      name: historyName,
    });
  }

  if (category.groupEnvironments && !category.groupBy?.some((selector) => selector === "environment")) {
    const environmentValue = tr.environment?.trim() ? tr.environment : EMPTY_VALUE;
    grouping.push({
      key: "environment",
      value: environmentValue,
      name: formatGroupName("environment", environmentValue),
    });
  }

  return grouping.length > 0 ? grouping : undefined;
};

export const toUploadCategoryFromContext = (
  tr: TestResultWithCategories,
  categories: CategoryDefinition[],
): UploadCategory | undefined => {
  if (!categories.length) {
    return undefined;
  }
  const matched = matchCategory(categories, extractErrorMatchingData(tr));
  if (!matched) {
    return undefined;
  }
  return {
    externalId: matched.id,
    name: matched.name,
    grouping: buildGrouping(tr, matched),
  };
};

export const buildUploadCategoryGrouping = (
  tr: TestResultWithCategories,
  category: CategoryDefinition,
): UploadCategory["grouping"] => buildGrouping(tr, category);

export function attachmentsResolverFactory(store: AllureStore) {
  const attachmentsResolver: AttachmentsResolver = async (tr) => {
    const attachments = await store.attachmentsByTrId(tr.id);
    const result: AttachmentForUpload[] = [];

    await Promise.all(
      attachments.map(async (attachment) => {
        const content = await store.attachmentContentById(attachment.id);
        const body = await content?.readContent(async (s) => s);
        // @ts-expect-error - FIXME
        const name = attachment.name || attachment.originalFileName;

        if (name === undefined || body === undefined) {
          return undefined;
        }

        result.push({
          originalFileName: name,
          contentType: attachment.contentType ?? "application/octet-stream",
          content: body,
        });
      }),
    );

    return result;
  };

  return attachmentsResolver;
}

export function fixturesResolverFactory(store: AllureStore) {
  const fixturesResolver: FixtureResolver = async (tr) => {
    const fixtures = await store.fixturesByTrId(tr.id);

    return fixtures.map((fxt) => ({
      ...fxt,
      type: fxt.type.toUpperCase() as TestOpsFixtureResult["type"],
      steps: unwrapStepsAttachments(fxt.steps),
    }));
  };

  return fixturesResolver;
}
