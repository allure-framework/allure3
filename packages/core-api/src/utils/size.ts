/** Per-attachment raw size at or above which single-file mode writes externally. */
export const HEAVY_ATTACHMENT_BYTES = 1_048_576; // 1 MiB

/** Soft warning when single-file HTML is this large or larger. */
export const LARGE_REPORT_WARN_BYTES = 50 * 1024 * 1024; // 50 MiB

/** Stronger warning when single-file HTML is this large or larger. */
export const LARGE_REPORT_SEVERE_BYTES = 100 * 1024 * 1024; // 100 MiB

/**
 * Formats a size in bytes to a human-readable string (B, KB, MB, GB) using 1024-based units.
 */
export const formatByteSize = (bytes: number): string => {
  const units = ["bytes", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  if (bytes === 0) {
    return "0 bytes";
  }

  return unitIndex === 0 ? `${Math.round(size)} ${units[unitIndex]}` : `${size.toFixed(2)} ${units[unitIndex]}`;
};

/**
 * Whether an attachment raw size should be treated as heavy for single-file hybrid mode.
 * Missing / non-finite sizes are not heavy (caller should re-check after reading the buffer).
 */
export const isHeavyAttachment = (
  sizeBytes: number | undefined | null,
  thresholdBytes: number = HEAVY_ATTACHMENT_BYTES,
): boolean => {
  if (sizeBytes == null || !Number.isFinite(sizeBytes)) {
    return false;
  }

  return sizeBytes >= thresholdBytes;
};

/** Rough base64-in-HTML size estimate (raw * 4/3). */
export const estimateBase64EmbeddedSize = (rawBytes: number): number => Math.ceil((rawBytes * 4) / 3);

/**
 * Warn when a single-file HTML payload is large enough to hurt load performance.
 * Does not throw; hard generation failures remain the caller's RangeError handling.
 */
export const warnIfLargeSingleFileReport = (
  htmlByteLength: number,
  log: (message: string) => void = console.warn,
): void => {
  if (htmlByteLength >= LARGE_REPORT_SEVERE_BYTES) {
    log(
      `Single-file report is very large (${formatByteSize(htmlByteLength)}). ` +
        `Performance issues are expected beyond ~${formatByteSize(LARGE_REPORT_SEVERE_BYTES)}. ` +
        "Prefer multi-file mode or ensure heavy attachments are written as external files. " +
        "Serve the report over HTTP (e.g. `allure open`) rather than opening the HTML via file://.",
    );
    return;
  }

  if (htmlByteLength >= LARGE_REPORT_WARN_BYTES) {
    log(
      `Single-file report is large (${formatByteSize(htmlByteLength)}). ` +
        `Load performance may degrade beyond ~${formatByteSize(LARGE_REPORT_WARN_BYTES)}. ` +
        "Consider multi-file mode for reports with heavy attachments.",
    );
  }
};
