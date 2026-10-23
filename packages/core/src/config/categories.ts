import type { CategoriesConfig, CategoryMatchingData, Matcher } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";

import { compilePredicate } from "./expressions.js";

export const resolveCategories = (value: Config["categories"]): CategoriesConfig | undefined => {
  if (value === undefined || value === false) {
    return value;
  }

  const resolveMatcher = (matcher: Matcher | string, path: string): Matcher => {
    if (typeof matcher !== "string") {
      return matcher;
    }
    const predicate = compilePredicate(matcher, path, { data: "map" });
    return (data: CategoryMatchingData) =>
      predicate({
        data: {
          status: data.status,
          flaky: data.flaky,
          message: data.message,
          trace: data.trace,
          duration: data.duration,
          transition: data.transition,
          environment: data.environment,
          labels: data.labels.map(({ name, value: labelValue }) => ({ name, value: labelValue })),
        },
      });
  };

  const rules = Array.isArray(value) ? value : value.rules;
  const resolved = rules.map((rule, index) => {
    const path = `categories[${index}].matchers`;
    const { matchers } = rule;
    return {
      ...rule,
      matchers: Array.isArray(matchers)
        ? matchers.map((matcher, matcherIndex) => resolveMatcher(matcher, `${path}[${matcherIndex}]`))
        : matchers === undefined
          ? undefined
          : resolveMatcher(matchers as Matcher | string, path),
    };
  });

  return Array.isArray(value) ? resolved : { ...value, rules: resolved };
};
