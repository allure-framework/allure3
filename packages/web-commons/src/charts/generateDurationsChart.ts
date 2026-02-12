import {
  type AllureChartsStoreData,
  ChartType,
  type DurationsChartData,
  type DurationsChartOptions,
} from "@allurereport/charts-api";
import type { TestResult } from "@allurereport/core-api";
import { createHashStorage } from "./utils.js";

type EnrichedTr = Omit<TestResult, "duration"> & {
  layer?: string;
  duration: number;
};

type Key = DurationsChartData["keys"];
type Bucket = DurationsChartData["data"][number];

const BY_NONE = "none";
const BY_LAYER = "layer";
const MAX_BUCKETS = 5;

const getDurations = (trs: EnrichedTr[]): Set<number> => {
  const durations = new Set<number>();

  for (const tr of trs) {
    const duration = tr.duration ?? (tr.stop ?? 0) - (tr.start ?? 0);
    durations.add(duration);
  }

  return durations;
};

const enrichAndFilterTrs = (trs: TestResult[], groupBy: DurationsChartOptions["groupBy"]): EnrichedTr[] => {
  const enrichedTrs: EnrichedTr[] = [];

  for (const tr of trs) {
    const enrichedTr: EnrichedTr = {
      ...tr,
      // Make sure duration is always present
      duration: tr.duration ?? (tr.stop ?? 0) - (tr.start ?? 0),
    };

    if (groupBy === BY_LAYER) {
      const layer = tr.labels?.find((l) => l.name === "layer")?.value;

      // Leave only tests with layer if grouping by layer
      if (!layer) {
        continue;
      }

      // Add layer to enriched test result
      enrichedTr.layer = layer;
    }

    enrichedTrs.push(enrichedTr);
  }

  return enrichedTrs;
};

const getBucketsFromDurations = (durations: number[]) => {
  if (durations.length === 0) {
    return [];
  }

  const sortedDurations = [...durations].sort((a, b) => a - b);
  const min = sortedDurations[0];
  const max = sortedDurations[sortedDurations.length - 1];

  // Calculate bucket size based on the range
  const bucketSize = Math.max(1, Math.ceil((max - min + 1) / MAX_BUCKETS));

  // Group durations into buckets and only create buckets that have data
  const bucketsMap = new Map<number, { from: number; to: number }>();

  for (const duration of sortedDurations) {
    // Calculate which bucket this duration belongs to
    const bucketIndex = Math.floor((duration - min) / bucketSize);
    const bucketFrom = min + bucketIndex * bucketSize;
    const bucketTo = Math.min(bucketFrom + bucketSize - 1, max);

    // Use bucketFrom as key to avoid duplicates
    if (!bucketsMap.has(bucketFrom)) {
      bucketsMap.set(bucketFrom, { from: bucketFrom, to: bucketTo });
    }
  }

  // Convert map to array and sort by 'from' to ensure order
  return Array.from(bucketsMap.values()).sort((a, b) => a.from - b.from);
};

export const generateDurationsChart = (props: {
  options: DurationsChartOptions;
  storeData: AllureChartsStoreData;
}): DurationsChartData | undefined => {
  const { options, storeData } = props;
  const { groupBy = BY_NONE, title } = options;

  const { testResults } = storeData;

  const enrichedTrs = enrichAndFilterTrs(testResults, groupBy);
  const durations = getDurations(enrichedTrs);

  const buckets: Bucket[] = durations.size > 0 ? getBucketsFromDurations(Array.from(durations)) : [];
  const hashes = createHashStorage();
  const keys: Key = {};

  if (groupBy === BY_NONE) {
    keys[hashes.get(BY_NONE)] = BY_NONE;
  }

  // Fill buckets with duration counts
  for (const tr of enrichedTrs) {
    // Buckets are calculated from enrichedTrs, so there always will be a bucket for the duration
    const bucket = buckets.find((b) => tr.duration >= b.from && tr.duration <= b.to)!;

    if (groupBy === BY_LAYER) {
      const layer = tr.layer!;
      keys[hashes.get(layer)] = layer;
      bucket[hashes.get(layer)] = (bucket[hashes.get(layer)] ?? 0) + 1;
    }

    if (groupBy === BY_NONE) {
      bucket[hashes.get(BY_NONE)] = (bucket[hashes.get(BY_NONE)] ?? 0) + 1;
    }
  }

  return {
    data: buckets,
    type: ChartType.Durations,
    title,
    keys,
    groupBy,
  };
};
