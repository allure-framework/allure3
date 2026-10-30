import { type LabelMatcher, compilePredicate, isExpression } from "@allurereport/core-api";
import type { Config } from "@allurereport/plugin-api";

export const resolveHideLabels = (value: Config["hideLabels"]): LabelMatcher[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new TypeError("hideLabels must be an array");
  }

  return value.map((matcher, index): LabelMatcher => {
    const path = `hideLabels[${index}]`;
    if (matcher instanceof RegExp) {
      return matcher;
    }
    if (typeof matcher !== "string") {
      throw new TypeError(`Invalid hidden-label matcher at ${path}: expected string or RegExp`);
    }
    if (matcher.startsWith("$${{")) {
      return matcher.slice(1);
    }
    if (!isExpression(matcher)) {
      return matcher;
    }
    const predicate = compilePredicate(matcher, path, { name: "string" });
    return (name) => predicate({ name });
  });
};
