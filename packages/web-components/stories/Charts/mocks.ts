const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

export const historyTimestamps = (count: number) =>
  Array.from({ length: count }, (_, index) => NOW - (count - index) * DAY);

export const formatTimestamp = (timestamp: unknown) =>
  new Date(timestamp as number).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const dictionary: Record<string, string> = {
  "no-results": "No results",
  "no-history": "No history yet",
  "ticks.current": "Current",
  "tooltips.current": "Current run",
  "legend.trend": "Trend",
  "legend.duration": "Duration",
  "legend.speedup": "Speedup",
  "legend.value": "Tests",
  "legend.total": "Total",
  "legend.stabilityRate": "Stability rate",
  "durations.sequential": "Sequential duration",
  "durations.duration": "Duration",
  "durations.speedup": "Speedup",
  "transitions.new": "New",
  "transitions.fixed": "Fixed",
  "transitions.regressed": "Regressed",
  "transitions.malfunctioned": "Malfunctioned",
  "status.passed": "Passed",
  "status.failed": "Failed",
  "status.broken": "Broken",
  "status.skipped": "Skipped",
  "status.unknown": "Unknown",
  "status.newpassed": "New passed",
  "status.newfailed": "New failed",
  "status.newbroken": "New broken",
  "status.newskipped": "New skipped",
  "status.newunknown": "New unknown",
  "status.removedpassed": "Removed passed",
  "status.removedfailed": "Removed failed",
  "status.removedbroken": "Removed broken",
  "status.removedskipped": "Removed skipped",
  "status.removedunknown": "Removed unknown",
  "severity.blocker": "Blocker",
  "severity.critical": "Critical",
  "severity.normal": "Normal",
  "severity.minor": "Minor",
  "severity.trivial": "Trivial",
  "severity.unset": "Unset",
};

export const chartI18n = (key: string, props?: Record<string, unknown>) => {
  if (key === "ticks.history") {
    return formatTimestamp(props?.timestamp);
  }

  if (key === "tooltips.history") {
    return `Run from ${formatTimestamp(props?.timestamp)}`;
  }

  if (key === "durations.range" || key === "ticks.durationRange" || key === "tooltips.durationRange") {
    return `${props?.from as string} - ${props?.to as string}`;
  }

  return dictionary[key] ?? key;
};
