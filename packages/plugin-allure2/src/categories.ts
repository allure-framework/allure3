import { categoryMatch } from "@allurereport/plugin-api/internal/report";

import type { Allure2Category, Allure2Status } from "./model.js";

const productDefects: Allure2Category = {
  name: "Product defects",
  matchedStatuses: ["failed"],
};

const testDefects: Allure2Category = {
  name: "Test defects",
  matchedStatuses: ["broken"],
};

export const matchCategories = (
  categories: Allure2Category[],
  result: { statusMessage?: string; statusTrace?: string; status: Allure2Status; flaky: boolean },
) => {
  const matched = categories.find((category) => categoryMatch(category, result));

  if (matched) {
    return [matched];
  }

  if (categoryMatch(productDefects, result)) {
    return [productDefects];
  }

  if (categoryMatch(testDefects, result)) {
    return [testDefects];
  }

  return [];
};
