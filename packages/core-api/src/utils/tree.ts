import type { Statistic } from "../aggregate.js";
import type { TestResult } from "../model.js";

type TreeNode<T> = Omit<T, "nodeId"> & {
  nodeId: string;
};

export interface WithChildren {
  groups?: string[];
  leaves?: string[];
}

export type TreeGroup<T> = TreeNode<T> & WithChildren;
export type TreeLeaf<T> = TreeNode<T>;

export type TreeData<L, G> = {
  root: WithChildren;
  leavesById: Record<string, TreeLeaf<L>>;
  groupsById: Record<string, TreeGroup<G>>;
};

export type DefaultTreeLeaf = Pick<TestResult, "name" | "status" | "duration">;
export type DefaultTreeGroup = {
  name: string;
  statistic: Statistic;
};
