import type { TreeGroup as CoreTreeGroup, TreeLeaf as CoreTreeLeaf } from "@allurereport/core-api";

export type TreeLeaf<T> = CoreTreeLeaf<T>;
export type TreeGroup<T> = CoreTreeGroup<T> & {
  trees: TreeGroup<T>[];
  leaves: CoreTreeLeaf<T>[];
};

export type Tree<T> = CoreTreeGroup<T> & {
  nodeId: string;
  leaves: TreeLeaf<T>[];
  trees: TreeGroup<T>[];
};

export type TreeLeafRow<T> = {
  type: "leaf";
  data: TreeLeaf<T>;
  offset: number;
};

export type TreeGroupRow<T> = {
  type: "group";
  data: TreeGroup<T>;
  offset: number;
};

export type TreeRow<T> = TreeLeafRow<T> | TreeGroupRow<T>;

export type FlatTree<T> = TreeRow<T>[];
