import type { CategoryDefinition, CategoryGroupSelector, TestResult } from "@allurereport/core-api";
import { EMPTY_VALUE, extractErrorMatchingData, findLastByLabelName, matchCategory } from "@allurereport/core-api";

import type { TestResultWithCategories, UploadCategory } from "./model.js";

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
  tr: Pick<TestResult, "status" | "labels" | "flaky" | "transition" | "environment">,
  category: CategoryDefinition,
): UploadCategory["grouping"] => {
  if (!category.groupBy?.length) {
    return undefined;
  }
  return category.groupBy.map((sel) => groupValue(sel, tr));
};

const fromContext = (tr: TestResultWithCategories, categories: CategoryDefinition[]): UploadCategory | undefined => {
  if (!categories.length) {
    return undefined;
  }
  const matched = matchCategory(categories, extractErrorMatchingData(tr));
  if (!matched) {
    return undefined;
  }
  return {
    externalId: matched.name,
    name: matched.name,
    grouping: buildGrouping(tr, matched),
  };
};

export const toUploadCategory = (
  tr: TestResultWithCategories,
  contextCategories: CategoryDefinition[],
): UploadCategory | undefined => {
  const c = tr.categories?.[0];
  if (c?.name) {
    return {
      externalId: c.name,
      name: c.name,
      grouping: c.grouping?.length ? c.grouping : undefined,
    };
  }
  return fromContext(tr, contextCategories);
};
