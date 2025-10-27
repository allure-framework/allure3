import {
  type AllureChartsStoreData,
  type BarChartData,
  type BarChartOptions,
  BarChartType,
  type BarGroup,
  BarGroupMode,
  ChartMode,
  ChartType,
} from "@allurereport/charts-api";

export const generateBarChartDurationsByLayer = (
  options: BarChartOptions,
  storeData: AllureChartsStoreData,
): BarChartData | undefined => {
  const testsDurationsByLayer = new Map<string, number[]>();

  const { testResults } = storeData;

  // Collect all durations by layers
  for (const testResult of testResults) {
    const layer = testResult.labels.find((label) => label.name === "layer")?.value;
    const duration = testResult.duration;

    if (!layer || !duration || isNaN(duration)) {
      continue;
    }

    if (!testsDurationsByLayer.has(layer)) {
      testsDurationsByLayer.set(layer, []);
    }

    testsDurationsByLayer.get(layer)?.push(duration);
  }

  // Return empty chart if no data
  if (testsDurationsByLayer.size === 0) {
    return {
      data: [],
      type: ChartType.Bar,
      dataType: BarChartType.DurationsByLayer,
      mode: ChartMode.Raw,
      title: options.title,
      keys: [],
      groupMode: BarGroupMode.Stacked,
      indexBy: "groupId",
    };
  }

  // Collect all durations to calculate buckets
  const allDurations = Array.from(testsDurationsByLayer.values()).flat();

  // Calculate buckets based on percentiles to ensure data in each bucket
  const maxBuckets = Math.min(6, allDurations.length);

  // Sort durations to calculate percentiles
  const sortedDurations = [...allDurations].sort((a, b) => a - b);
  const buckets: { min: number; max: number; label: string }[] = [];

  if (maxBuckets === 1) {
    // Single bucket for all data
    buckets.push({
      min: Math.min(...allDurations),
      max: Infinity,
      label: `${Math.round(Math.min(...allDurations))}+ms`,
    });
  } else {
    // Create buckets based on quantiles to ensure data distribution
    for (let i = 0; i < maxBuckets; i++) {
      const quantile = i / maxBuckets;
      const nextQuantile = (i + 1) / maxBuckets;

      // Calculate quantile indices
      const minIndex = Math.floor(quantile * (sortedDurations.length - 1));
      const maxIndex = Math.floor(nextQuantile * (sortedDurations.length - 1));

      const bucketMin = sortedDurations[minIndex];
      const bucketMax = i === maxBuckets - 1 ? sortedDurations[sortedDurations.length - 1] : sortedDurations[maxIndex];

      const label =
        i === maxBuckets - 1 ? `${Math.round(bucketMin)}+ms` : `${Math.round(bucketMin)}-${Math.round(bucketMax)}ms`;

      buckets.push({
        min: bucketMin,
        max: bucketMax,
        label,
      });
    }
  }

  // Count tests in each bucket for each layer
  const layerNames = Array.from(testsDurationsByLayer.keys());
  const bucketCounts = new Map<string, Map<string, number>>();

  // Initialize counters
  for (const layer of layerNames) {
    bucketCounts.set(layer, new Map());
    for (let i = 0; i < buckets.length; i++) {
      bucketCounts.get(layer)!.set(i.toString(), 0);
    }
  }

  // Count tests
  for (const [layer, durations] of testsDurationsByLayer) {
    for (const duration of durations) {
      for (let i = 0; i < buckets.length; i++) {
        const bucket = buckets[i];
        if (duration >= bucket.min && duration < bucket.max) {
          const currentCount = bucketCounts.get(layer)!.get(i.toString()) || 0;
          bucketCounts.get(layer)!.set(i.toString(), currentCount + 1);
          break;
        }
      }
    }
  }

  // Build chart data
  const chartData: BarGroup<string, string>[] = buckets
    .map((bucket, bucketIndex) => {
      const dataPoint: BarGroup<string, string> = {
        groupId: bucket.label,
      } as BarGroup<string, string>;

      let totalTests = 0;
      for (const layer of layerNames) {
        const count = bucketCounts.get(layer)?.get(bucketIndex.toString()) || 0;
        (dataPoint as any)[layer] = count;
        totalTests += count;
      }

      return { dataPoint, totalTests };
    })
    .filter(({ totalTests }) => totalTests > 0) // Filter out empty buckets
    .map(({ dataPoint }) => dataPoint);

  // Return empty chart if no data after filtering
  if (chartData.length === 0) {
    return {
      data: [],
      type: ChartType.Bar,
      dataType: BarChartType.DurationsByLayer,
      mode: ChartMode.Raw,
      title: options.title,
      keys: [],
      groupMode: BarGroupMode.Stacked,
      indexBy: "groupId",
    };
  }

  return {
    data: chartData,
    type: ChartType.Bar,
    dataType: BarChartType.DurationsByLayer,
    mode: ChartMode.Raw,
    title: options.title,
    keys: layerNames,
    groupMode: BarGroupMode.Stacked,
    indexBy: "groupId",
    xAxisConfig: {
      legend: "Duration",
    },
    yAxisConfig: {
      legend: "Number of Tests",
      format: " >-~s",
      tickValues: 5,
    },
  };
};
