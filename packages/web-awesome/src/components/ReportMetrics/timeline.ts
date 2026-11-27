import type { MetricSample } from "@allurereport/core-api";

import type { MetricsWidgetData } from "@/stores/metrics";

export type MetricInterval = { sample: MetricSample; index: number; lane: number };
export type MetricTimelineRow = { depth: number; intervals: MetricInterval[]; lanes: number };

const intervalDuration = ({ start, stop }: MetricSample) => {
  const duration = stop - start;
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
};

export const metricTimeline = (data: MetricsWidgetData, selectedRoot?: string, minimumWidthRatio = 0) => {
  const positions = new Map<string, { root: string; depth: number; timeline?: false }>();
  const stack = [...(data.hierarchy ?? [])].reverse().map((node) => ({ node, root: node.key, depth: 0 }));
  while (stack.length) {
    const { node, root, depth } = stack.pop()!;
    positions.set(node.key, { root, depth, timeline: node.timeline });
    for (let i = node.children.length - 1; i >= 0; i--) stack.push({ node: node.children[i], root, depth: depth + 1 });
  }
  const longestByRoot = new Map<string, number>();
  for (const sample of data.current) {
    const position = positions.get(sample.key) ?? { root: sample.key, depth: 0 };
    positions.set(sample.key, position);
    if (position.timeline === false) continue;
    const length = intervalDuration(sample) ?? -1;
    longestByRoot.set(position.root, Math.max(longestByRoot.get(position.root) ?? -1, length));
  }
  const roots = [...longestByRoot.keys()].sort();
  const defaultRoot = roots.reduce<string | undefined>(
    (best, key) => (!best || longestByRoot.get(key)! > longestByRoot.get(best)! ? key : best),
    undefined,
  );
  const root = selectedRoot && longestByRoot.has(selectedRoot) ? selectedRoot : defaultRoot;
  const byDepth = new Map<number, { sample: MetricSample; index: number }[]>();
  let excluded = 0;
  let start = Infinity;
  let stop = -Infinity;
  data.current.forEach((sample, index) => {
    const position = positions.get(sample.key)!;
    if (position.root !== root || position.timeline === false) return;
    if (intervalDuration(sample) === undefined) {
      excluded++;
      return;
    }
    start = Math.min(start, sample.start);
    stop = Math.max(stop, sample.stop);
    const { depth } = position;
    const samples = byDepth.get(depth) ?? [];
    samples.push({ sample, index });
    byDepth.set(depth, samples);
  });
  const duration = stop - start;
  const minimumDuration = Number.isFinite(duration) ? duration * minimumWidthRatio : 0;
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
        ends[lane] = { stop: Math.max(sample.stop, sample.start + minimumDuration), point };
        return { sample, index, lane };
      });
      return { depth, intervals, lanes: ends.length };
    });
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
