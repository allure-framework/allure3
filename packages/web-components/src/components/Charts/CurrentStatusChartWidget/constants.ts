import type { Statistic } from "@allurereport/core-api";
import type { ChartDatum } from "./types";

export const PIE_PADDING = 8;
export const MAX_ADDITIONAL_STATS_WIDTH = 46;
export const GAP = 16;
export const MAX_PIE_WIDTH = 300;
export const EMPTY_ARC: ChartDatum = {
  id: "__EMPTY_ARC_DO_NOT_COUNT_IT_USED_FOR_VISUALS__",
  // We need to set value to 1 to make sure that the arc is visible
  value: 1,
  color: "var(--bg-control-secondary)",
  label: "",
};

export const ADD_STATS_KEYS = ["new", "flaky", "retries"] as (keyof Pick<Statistic, "new" | "flaky" | "retries">)[];
