import {
  setStatusFilter,
  statusFilter,
} from "@allurereport/web-commons";
import { computed } from "@preact/signals";
import type { AwesomeStatus } from "types";

export const treeAwesomeStatus = computed<AwesomeStatus>(() => statusFilter.value ?? "total");
export const setTreeAwesomeStatus = (status: AwesomeStatus) => {
  setStatusFilter(status === "total" ? undefined : status);
};
