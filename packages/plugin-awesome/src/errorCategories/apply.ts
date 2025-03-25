import type { ErrorCategoryNorm } from "@allurereport/core-api";
import { extractErrorMatchingData, matchCategory } from "@allurereport/core-api";
import type { AwesomeTestResult } from "@allurereport/web-awesome";

export const applyCategoriesToTestResults = (tests: AwesomeTestResult[], categories: ErrorCategoryNorm[]) => {
  for (const tr of tests) {
    const matchingData = extractErrorMatchingData(tr);
    const matched = matchCategory(categories, matchingData);
    if (!matched) {
      tr.categories = [];
      continue;
    }

    tr.categories = [{ name: matched.name }];
  }
};
