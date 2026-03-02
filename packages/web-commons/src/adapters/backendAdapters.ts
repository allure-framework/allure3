/**
 * Adapters for backend API responses to report UI formats.
 * Used when fetching report data from backend (apiBaseUrl mode).
 */
import { ChartType } from "@allurereport/charts-api";
import type { ChartsResponse, CurrentStatusChartData } from "../charts/types.js";

/** Minimal Statistic shape (compatible with @allurereport/core-api) */
interface Statistic {
  total: number;
  passed?: number;
  failed?: number;
  broken?: number;
  skipped?: number;
  unknown?: number;
}

/** Minimal TreeData shape (compatible with core-api TreeData) */
interface TreeDataShape {
  root: { groups?: string[]; leaves?: string[] };
  leavesById: Record<string, TreeLeafShape>;
  groupsById: Record<string, TreeGroupShape>;
}

/** Backend tree node (from GET /api/v1/trees/:type) */
interface BackendTreeNode {
  name: string;
  uid?: string;
  duration?: number;
  tags?: string[];
  children?: BackendTreeNode[];
  statistic?: {
    total: number;
    passed?: number;
    failed?: number;
    broken?: number;
    skipped?: number;
    unknown?: number;
  };
}

interface BackendTreeResponse {
  type: string;
  root: BackendTreeNode;
}

/** Minimal tree group/leaf compatible with TreeData */
interface TreeGroupShape {
  nodeId: string;
  name: string;
  statistic: Statistic;
  groups?: string[];
  leaves?: string[];
}

interface TreeLeafShape {
  nodeId: string;
  name: string;
  status?: string;
  duration?: number;
  groupOrder?: number;
  [key: string]: unknown;
}

let nodeIdCounter = 0;
function nextNodeId(): string {
  nodeIdCounter += 1;
  return `node-${nodeIdCounter}-${Date.now()}`;
}

function backendStatisticToStatistic(s?: BackendTreeNode["statistic"]): Statistic {
  if (!s) return { total: 0 };
  return {
    total: s.total ?? 0,
    passed: s.passed ?? 0,
    failed: s.failed ?? 0,
    broken: s.broken ?? 0,
    skipped: s.skipped ?? 0,
    unknown: s.unknown ?? 0
  };
}

function treeNodeToTreeData(
  root: BackendTreeNode
): { root: { groups: string[]; leaves: string[] }; leavesById: Record<string, TreeLeafShape>; groupsById: Record<string, TreeGroupShape> } {
  const leavesById: Record<string, TreeLeafShape> = {};
  const groupsById: Record<string, TreeGroupShape> = {};

  function walk(node: BackendTreeNode): string {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const nodeId = node.uid ?? nextNodeId();

    if (hasChildren) {
      const groupIds: string[] = [];
      const leafIds: string[] = [];
      for (const child of node.children!) {
        const childId = walk(child);
        if (groupsById[childId]) groupIds.push(childId);
        else leafIds.push(childId);
      }
      groupsById[nodeId] = {
        nodeId,
        name: node.name,
        statistic: backendStatisticToStatistic(node.statistic),
        groups: groupIds,
        leaves: leafIds
      };
      return nodeId;
    } else {
      const stat = node.statistic;
      let status: string | undefined;
      if (stat && typeof stat === "object") {
        const s = stat as Record<string, number>;
        for (const k of ["passed", "failed", "broken", "skipped", "unknown"] as const) {
          if (s[k] && s[k] > 0) {
            status = k;
            break;
          }
        }
      }
      leavesById[nodeId] = {
        nodeId,
        name: node.name,
        status,
        duration: node.duration,
        groupOrder: 0,
        tags: node.tags ?? []
      };
      return nodeId;
    }
  }

  const rootId = walk(root);
  const isRootGroup = rootId in groupsById;
  return {
    root: isRootGroup ? { groups: [rootId], leaves: [] } : { groups: [], leaves: [rootId] },
    leavesById,
    groupsById
  };
}

export function adaptTreeResponse(raw: unknown): TreeDataShape {
  const res = raw as BackendTreeResponse;
  if (!res?.root) return { root: { groups: [], leaves: [] }, leavesById: {}, groupsById: {} };
  nodeIdCounter = 0;
  return treeNodeToTreeData(res.root);
}

export function adaptWidgetToStatistic(raw: unknown): Statistic {
  const data = raw as Record<string, number | string> | undefined;
  if (!data) return { total: 0 };
  const num = (v: number | string | undefined): number => (v === undefined || v === null ? 0 : Number(v));
  return {
    total: num(data.total),
    passed: num(data.passed),
    failed: num(data.failed),
    broken: num(data.broken),
    skipped: num(data.skipped),
    unknown: num(data.unknown)
  };
}

export function adaptWidgetToChartsResponse(raw: unknown): ChartsResponse {
  const data = raw as { statistic?: Record<string, number> } | undefined;
  const statistic = adaptWidgetToStatistic(data?.statistic ?? data);

  const currentStatusChart: CurrentStatusChartData = {
    type: ChartType.CurrentStatus,
    data: statistic
  };

  return {
    general: { "current-status": currentStatusChart },
    byEnv: {}
  };
}

export function adaptNavResponse(raw: unknown): string[] {
  const res = raw as { data?: Array<{ id?: string }> };
  const list = res?.data ?? [];
  return list.map((r) => r.id ?? "").filter(Boolean);
}

/** Backend TestResult is core-api TestResult; add fields expected by Classic/Awesome UI */
export function adaptTestResultToClassic(raw: unknown): Record<string, unknown> {
  const tr = raw as Record<string, unknown>;
  const labels = (tr.labels as Array<{ name: string; value?: string }>) ?? [];
  const groupedLabels: Record<string, string[]> = {};
  for (const l of labels) {
    const name = l.name ?? "";
    if (!groupedLabels[name]) groupedLabels[name] = [];
    groupedLabels[name].push(l.value ?? "");
  }
  const steps = tr.steps ?? [];
  const error = tr.error ?? null;
  return {
    ...tr,
    groupedLabels,
    breadcrumbs: [],
    setup: tr.setup ?? [],
    teardown: tr.teardown ?? [],
    steps,
    error,
    retry: tr.retry ?? false,
    history: tr.history ?? [],
    retries: tr.retries ?? [],
    attachments: tr.attachments ?? [],
    parameters: tr.parameters ?? [],
    links: tr.links ?? []
  };
}
