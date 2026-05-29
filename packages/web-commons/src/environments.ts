import type { EnvironmentIdentity } from "@allurereport/core-api";
import { validateEnvironmentId, validateEnvironmentName } from "@allurereport/core-api";

export const normalizeEnvironmentsWidget = (raw: unknown): EnvironmentIdentity[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  const out: EnvironmentIdentity[] = [];

  for (const item of raw) {
    if (typeof item === "string") {
      out.push({ id: item, name: item });
      continue;
    }

    if (!item || typeof item !== "object") {
      continue;
    }

    const rec = item as Record<string, unknown>;

    if (typeof rec.id !== "string") {
      continue;
    }

    const idResult = validateEnvironmentId(rec.id);

    if (!idResult.valid) {
      continue;
    }

    const rawName = rec.name;

    if (typeof rawName === "string") {
      const nameResult = validateEnvironmentName(rawName);

      if (nameResult.valid) {
        out.push({ id: idResult.normalized, name: nameResult.normalized });
        continue;
      }
    }

    out.push({ id: idResult.normalized, name: idResult.normalized });
  }

  return out;
};

export const environmentNameById = (environments: EnvironmentIdentity[], environmentId: string) =>
  environments.find(({ id }) => id === environmentId)?.name ?? environmentId;

export const migrateStoredEnvironmentSelection = (
  storedEnvironment: string,
  environments: EnvironmentIdentity[],
): string => {
  if (!storedEnvironment) {
    return "";
  }

  if (environments.some(({ id }) => id === storedEnvironment)) {
    return storedEnvironment;
  }

  const matches = environments.filter(({ name }) => name === storedEnvironment);

  if (matches.length === 1) {
    return matches[0]!.id;
  }

  return "";
};
