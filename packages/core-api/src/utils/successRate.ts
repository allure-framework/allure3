import type { Statistic } from "../aggregate.js";
import { includedInSuccessRate } from "../constants.js";

/** Counts only results eligible for the success rate, without changing report totals. */
export const getSuccessRateTotal = (statistic: Partial<Statistic>): number =>
  Array.from(includedInSuccessRate).reduce((total, status) => total + (statistic[status] ?? 0), 0);

/** Returns an unrounded ratio. Runs without eligible results have a rate of zero. */
export const getSuccessRate = (statistic: Partial<Statistic>): number => {
  const total = getSuccessRateTotal(statistic);

  return total > 0 ? (statistic.passed ?? 0) / total : 0;
};
