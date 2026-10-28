import type { TestStatus } from "@allurereport/core-api";
import { categoryMatch } from "@allurereport/plugin-api/internal/report";

import type { ClassicCategory } from "./model.js";

const productDefects: ClassicCategory = {
  name: "Product defects",
  matchedStatuses: ["failed"],
};

const testDefects: ClassicCategory = {
  name: "Test defects",
  matchedStatuses: ["broken"],
};

export const matchCategories = (
  categories: ClassicCategory[],
  result: {
    message?: string;
    trace?: string;
    statusMessage?: string;
    statusTrace?: string;
    status: TestStatus;
    flaky: boolean;
  },
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
