import type { EnvironmentIdentity } from "@allurereport/core-api";

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
