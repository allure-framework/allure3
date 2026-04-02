import { platform } from "node:os";

/** True when Node runs on Windows (path and file-name rules differ from POSIX). */
export function isWindows(): boolean {
  return platform() === "win32";
}

const hasWindowsForbiddenPluginIdChar = (id: string): boolean => {
  if (/["<>|?*:]/.test(id)) {
    return true;
  }
  for (let i = 0; i < id.length; i++) {
    const code = id.charCodeAt(i);
    if (code <= 0x1f) {
      return true;
    }
  }
  return false;
};

const PLUGIN_ID_WINDOWS_RESERVED = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM0",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT0",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

/**
 * Extra plugin id checks for Windows (call only when {@link isWindows} is true).
 */
export function assertValidPluginIdForWindows(id: string): void {
  if (hasWindowsForbiddenPluginIdChar(id)) {
    throw new Error(`Invalid plugin id ${JSON.stringify(id)}: contains characters not allowed in Windows file names`);
  }

  const dotSegment = id.includes(".") ? id.slice(0, id.indexOf(".")) : id;

  if (PLUGIN_ID_WINDOWS_RESERVED.has(dotSegment.toUpperCase())) {
    throw new Error(`Invalid plugin id ${JSON.stringify(id)}: reserved device name on Windows`);
  }
}
