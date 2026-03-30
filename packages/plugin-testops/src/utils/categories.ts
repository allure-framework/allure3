import type { CategoryDefinition, CategoryGroupSelector, TestResult } from "@allurereport/core-api";
import { EMPTY_VALUE, extractErrorMatchingData, findLastByLabelName, matchCategory } from "@allurereport/core-api";

import type { TestResultWithCategories, UploadCategory } from "../model.js";

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
