import type { CategoryDefinition } from "@allurereport/core-api";

import type { TestResultWithCategories, UploadCategory } from "./model.js";
import { buildUploadCategoryGrouping, toUploadCategoryFromContext } from "./utils/categories.js";

export const toUploadCategory = (
  tr: TestResultWithCategories,
  contextCategories: CategoryDefinition[],
): UploadCategory | undefined => {
  const c = tr.categories?.[0];
  if (c?.name) {
    const externalId = c.id ?? c.name;
    const groupingFromTestResult = c.grouping?.length ? c.grouping : undefined;
    const contextCategory =
      groupingFromTestResult === undefined
        ? contextCategories.find(
            (category) => category.id === externalId || category.name === c.name,
          )
        : undefined;
    return {
      externalId,
      name: c.name,
      grouping:
        groupingFromTestResult ??
        (contextCategory && buildUploadCategoryGrouping(tr, contextCategory)),
    };
  }
  return toUploadCategoryFromContext(tr, contextCategories);
};
