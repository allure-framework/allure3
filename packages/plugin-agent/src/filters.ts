import type { TestLabel } from "@allurereport/core-api";

import type { AgentLabelFilter } from "./selection.js";

export const matchesLabelFilters = (labels: TestLabel[], filters: AgentLabelFilter[]) =>
  filters.every((filter) => labels.some((label) => label.name === filter.name && label.value === filter.value));
