import type { MetricSample } from "@allurereport/core-api";

import type { MetricsWidgetData } from "@/stores/metrics";

export type MetricInterval = { sample: MetricSample; index: number; lane: number };
export type MetricTimelineRow = { depth: number; intervals: MetricInterval[]; lanes: number };

export const metricTimeline = (data: MetricsWidgetData, selectedRoot?: string) => {
  const positions = new Map<string, { root: string; depth: number }>();
  const stack = [...(data.hierarchy ?? [])].reverse().map((node) => ({ node, root: node.key, depth: 0 }));
  while (stack.length) {
    const { node, root, depth } = stack.pop()!;
    positions.set(node.key, { root, depth });
    for (let i = node.children.length - 1; i >= 0; i--) stack.push({ node: node.children[i], root, depth: depth + 1 });
  }
  const unconfigured = [...new Set(data.current.map(({ key }) => key))].filter((key) => !positions.has(key)).sort();
  for (const key of unconfigured) {
    positions.set(key, { root: key, depth: 0 });
  }
  const observedRoots = new Set(data.current.map(({ key }) => positions.get(key)!.root));
  const roots = [...observedRoots].sort();
  const root = selectedRoot && observedRoots.has(selectedRoot) ? selectedRoot : roots[0];
  const byDepth = new Map<number, { sample: MetricSample; index: number }[]>();
  let excluded = 0;
  let start = Infinity;
  let stop = -Infinity;
  data.current.forEach((sample, index) => {
    if (positions.get(sample.key)!.root !== root) return;
    const duration = sample.stop - sample.start;
    if (!Number.isFinite(sample.start) || !Number.isFinite(sample.stop) || !Number.isFinite(duration) || duration < 0) {
      excluded++;
      return;
    }
    start = Math.min(start, sample.start);
    stop = Math.max(stop, sample.stop);
    const depth = positions.get(sample.key)!.depth;
    const samples = byDepth.get(depth) ?? [];
    samples.push({ sample, index });
    byDepth.set(depth, samples);
  });
  const rows: MetricTimelineRow[] = [...byDepth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([depth, samples]) => {
      samples.sort(
        (a, b) =>
          a.sample.start - b.sample.start || a.sample.stop - b.sample.stop || a.sample.id.localeCompare(b.sample.id),
      );
      const ends: { stop: number; point: boolean }[] = [];
      const intervals = samples.map(({ sample, index }) => {
        const point = sample.start === sample.stop;
        let lane = ends.findIndex(
          (end) => end.stop < sample.start || (end.stop === sample.start && !end.point && !point),
        );
        if (lane < 0) lane = ends.length;
        ends[lane] = { stop: sample.stop, point };
        return { sample, index, lane };
      });
      return { depth, intervals, lanes: ends.length };
    });
  const duration = stop - start;
  return {
    roots,
    root,
    rows,
    start,
    stop,
    duration,
    excluded,
    hasIntervals: Number.isFinite(duration) && duration >= 0,
  };
};
