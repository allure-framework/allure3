import type { MetricLine } from "./model.js";
import { normalize } from "./prometheus.js";

const escapeKey = (value: string): string => value.replace(/[,= ]/g, (char) => `\\${char}`);

/**
 * Same line layout as Allure 2: `<name> <key>=<value> <timestamp>`, the timestamp being the current time
 * in nanoseconds with seconds precision.
 */
export const renderInfluxDb = (lines: MetricLine[], now: Date = new Date()): string => {
  const timestamp = BigInt(Math.floor(now.getTime() / 1000)) * 1_000_000_000n;

  return (
    lines
      .map(({ name, key, value }) => `${escapeKey(name)} ${escapeKey(normalize(key))}=${value} ${timestamp}`)
      .join("\n") + "\n"
  );
};
