import type { Statistic } from "@allurereport/core-api";

export type TreeNavNodeKind = "env" | "group" | "leaf";

export type FlatTreeNode = {
  kind: TreeNavNodeKind;
  id: string;
  nodeId?: string;
  testResultId?: string;
  depth: number;
  parentId?: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
  /** Default open state for `toggleTree` / `setTreeOpened` (defaults to true). */
  openedByDefault?: boolean;
};

export type FlattenTreeInput = {
  nodeId: string;
  name?: string;
  statistic?: Statistic;
  leaves: Array<{ nodeId: string }>;
  trees: FlattenTreeInput[];
};

export type EnvTreeSection = {
  id: string;
  opened: boolean;
  tree: FlattenTreeInput;
  statistic?: Statistic;
};

export type FlattenVisibleTreeOptions = {
  collapsedTrees: ReadonlySet<string>;
  /** When set, must match report tree open state (e.g. awesome `isTreeOpened`). */
  isGroupOpened?: (scopedNodeId: string, openedByDefault: boolean) => boolean;
  tree?: FlattenTreeInput;
  rootStatistic?: Statistic;
  isRoot?: boolean;
  envSections?: EnvTreeSection[];
};

export type MoveDirection =
  | "up"
  | "down"
  | "left"
  | "right"
  | "parent"
  | "firstChild"
  | "home"
  | "end"
  | "firstLeaf"
  | "lastLeaf";

export type MoveFocusResult = {
  nextId: string | undefined;
  collapse?: boolean;
  expand?: boolean;
};
