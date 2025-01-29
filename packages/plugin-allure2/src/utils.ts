import type { Statistic } from "@allurereport/core-api";
import type { Allure2Status, Allure2TestResult, GroupTime } from "./model.js";
import { statisticKeys } from "./model.js";
import type { TreeGroup, TreeLeaf } from "./tree.js";

export const updateStatistic = (statistic: Statistic, test: { status: Allure2Status }): undefined => {
  statistic[test.status] = (statistic[test.status] ?? 0) + 1;
  statistic.total = (statistic.total ?? 0) + 1;
};

export const updateTime = (time: GroupTime, test: Allure2TestResult): undefined => {
  const { start, stop, duration } = test.time;
  if (duration === undefined) {
    return;
  }

  time.maxDuration = Math.max(time.maxDuration ?? 0, duration);
  time.minDuration = Math.min(time.minDuration ?? Number.MAX_VALUE, duration);
  time.sumDuration = (time.sumDuration ?? 0) + duration;

  if (start !== undefined) {
    time.start = Math.min(time.start ?? Number.MAX_VALUE, start);
  }
  if (stop !== undefined) {
    time.stop = Math.max(time.stop ?? Number.MIN_VALUE, stop);
  }

  if (time.start !== undefined && time.stop !== undefined) {
    time.duration = Math.max(0, time.stop - time.start);
  }
};

export const calculateStatisticByLeafs = (treeGroup: TreeGroup): Statistic => {
  const current: Statistic = { total: 0 };
  treeGroup.children.forEach((child) => {
    if ("children" in child) {
      const childGroup = child as TreeGroup;
      const statistic = calculateStatisticByLeafs(childGroup);
      statisticKeys.forEach((key) => {
        const statisticElement = statistic[key];
        if (statisticElement !== undefined) {
          current[key] = (current[key] ?? 0) + statisticElement;
        }
      });
    } else {
      const childLeaf = child as TreeLeaf;
      updateStatistic(current, childLeaf);
    }
  });
  return current;
};
