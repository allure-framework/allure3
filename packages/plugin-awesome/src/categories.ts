import type { TestStatus } from "@allurereport/core-api";
import type { AwesomeCategory } from "./model.js";

const productDefects: AwesomeCategory = {
  name: "Product defects",
  matchedStatuses: ["failed"],
};

const testDefects: AwesomeCategory = {
  name: "Test defects",
  matchedStatuses: ["broken"],
};

export const matchCategories = (
  categories: AwesomeCategory[],
  result: { message?: string; trace?: string; status: TestStatus; flaky: boolean },
) => {
  const matched = categories.filter((category) => categoryMatch(category, result));

  if (matched.length === 0 && categoryMatch(productDefects, result)) {
    matched.push(productDefects);
  }
  if (matched.length === 0 && categoryMatch(testDefects, result)) {
    matched.push(testDefects);
  }
  return matched;
};

const categoryMatch = (
  category: AwesomeCategory,
  result: { message?: string; trace?: string; status: TestStatus; flaky: boolean },
): boolean => {
  const { status, message, trace, flaky } = result;
  const matchesStatus =
    !category.matchedStatuses || category.matchedStatuses.length === 0 || category.matchedStatuses.includes(status);
  const matchesMessage = match(category.messageRegex, message);
  const matchesTrace = match(category.traceRegex, trace);
  const matchesFlaky = (category.flaky ?? flaky) === flaky;

  return matchesStatus && matchesMessage && matchesTrace && matchesFlaky;
};

const match = (regex?: string, value?: string): boolean => {
  if (!regex) {
    return true;
  }
  if (!value) {
    return false;
  }
  try {
    return new RegExp(regex, "s").test(value);
  } catch (ignored) {
    return false;
  }
};
