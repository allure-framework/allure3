import { realpathSync } from "node:fs";
import { basename, relative, resolve, sep } from "node:path";

export const ARTIFACTS_MANIFEST_FILENAME = "artifacts.json";

export type ReportArtifact = {
  name: string;
  path: string;
};

export type ReportArtifactsManifest = ReportArtifact[];

export type RestoreStateDumpInput = {
  artifactPath?: string;
  path: string;
  recordArtifact?: boolean;
};

const existingRealPath = (filePath: string): string => {
  try {
    return realpathSync(filePath);
  } catch {
    return filePath;
  }
};

export const normalizeArtifactPath = (filePath: string, cwd: string): string => {
  const path = relative(resolve(cwd), resolve(cwd, filePath)).split(sep).join("/");

  return path || ".";
};

export const createReportArtifact = (filePath: string, cwd: string, name = basename(filePath)): ReportArtifact => ({
  name,
  path: normalizeArtifactPath(filePath, cwd),
});

export const deduplicateDumpInputs = (dumps: RestoreStateDumpInput[], cwd: string): RestoreStateDumpInput[] => {
  const seen = new Set<string>();

  return dumps.reduce<RestoreStateDumpInput[]>((acc, dump) => {
    const absolutePath = resolve(cwd, dump.path);
    const dedupeKey = existingRealPath(absolutePath);

    if (seen.has(dedupeKey)) {
      return acc;
    }

    seen.add(dedupeKey);
    acc.push({
      ...dump,
      path: absolutePath,
    });

    return acc;
  }, []);
};
