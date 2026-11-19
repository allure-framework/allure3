import { formatDuration } from "@allurereport/core-api";

/**
 * Formats a duration for the classic report. Like Allure 2, shows nothing when the duration is unknown
 * (no start/stop) instead of the "unknown" text of `formatDuration`
 */
export const formatClassicDuration = (duration?: number): string | undefined =>
  typeof duration === "number" ? formatDuration(duration) : undefined;
