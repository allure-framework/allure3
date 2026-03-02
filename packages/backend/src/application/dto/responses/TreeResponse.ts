export interface TreeNode {
  name: string;
  uid?: string;
  duration?: number;
  tags?: string[];
  children?: TreeNode[];
  statistic?: {
    total: number;
    passed?: number;
    failed?: number;
    broken?: number;
    skipped?: number;
    unknown?: number;
  };
}

export interface TreeResponse {
  type: 'suites' | 'packages' | 'behaviors';
  root: TreeNode;
}
