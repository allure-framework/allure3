import type { TestLabel } from "../index.js";

export const findByLabelName = (labels: TestLabel[], name: string): string | undefined => {
  return labels.find((label) => label.name === name)?.value;
};

export const findLastByLabelName = (labels: TestLabel[], name: string): string | undefined => {
  for (let i = labels.length - 1; i >= 0; i -= 1) {
    if (labels[i].name === name) {
      return labels[i].value;
    }
  }
  return undefined;
};

export type LabelMatcher = string | RegExp | ((name: string) => boolean);

export const shouldHideLabel = (labelName: string, matchers: readonly LabelMatcher[] = []): boolean => {
  if (labelName.startsWith("_")) {
    return true;
  }

  return matchers.some((matcher) => {
    if (typeof matcher === "function") {
      return matcher(labelName);
    }
    if (typeof matcher === "string") {
      return matcher === labelName;
    }

    return new RegExp(matcher.source, matcher.flags).test(labelName);
  });
};
