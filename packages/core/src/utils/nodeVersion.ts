export const MINIMUM_NODE_VERSION_FOR_TS_CONFIG = "22.18.0";

export const parseNodeVersion = (version: string): { major: number; minor: number; patch: number } => {
  const [major = "0", minor = "0", patch = "0"] = version.split(".");

  return {
    major: Number.parseInt(major, 10) || 0,
    minor: Number.parseInt(minor, 10) || 0,
    patch: Number.parseInt(patch, 10) || 0,
  };
};

export const satisfiesMinimumNodeVersion = (
  version: string,
  minimum: string = MINIMUM_NODE_VERSION_FOR_TS_CONFIG,
): boolean => {
  const actual = parseNodeVersion(version);
  const required = parseNodeVersion(minimum);

  if (actual.major !== required.major) {
    return actual.major > required.major;
  }

  if (actual.minor !== required.minor) {
    return actual.minor > required.minor;
  }

  return actual.patch >= required.patch;
};

export const formatTsConfigNodeVersionError = (version: string): string => {
  return [
    `Cannot load a TypeScript Allure config (allurerc.ts, .mts, or .cts) on Node.js ${version}.`,
    `Node.js >= ${MINIMUM_NODE_VERSION_FOR_TS_CONFIG} is required for native TypeScript config loading.`,
    "Upgrade Node.js, or use a JavaScript/JSON/YAML config instead (for example allurerc.mjs, allurerc.js, or allurerc.json).",
  ].join(" ");
};

export const assertNodeSupportsTsConfig = (version: string = process.versions.node): void => {
  if (!satisfiesMinimumNodeVersion(version)) {
    throw new Error(formatTsConfigNodeVersionError(version));
  }
};
