import { DEFAULT_ENVIRONMENT } from "@allurereport/core-api";

/**
 * Resolves the environment buckets of a global widget entry (attachments, errors) which have to be
 * rendered for the currently selected environment.
 *
 * Global data which isn't bound to a particular environment is indexed under the default one. Such
 * entries aren't environment specific, so they stay visible while a single environment is selected,
 * together with the entries of that environment.
 *
 * @param all - flat list of every entry, used by the reports which have no per-environment breakdown
 * @param entriesByEnv - entries indexed by environment id
 * @param environmentId - currently selected environment id, empty string for "All"
 * @returns non-empty buckets as `[environmentId, entries]` pairs, in rendering order
 */
export const globalEntriesByEnv = <T>(
  all: T[],
  entriesByEnv: Record<string, T[]>,
  environmentId: string,
): [string, T[]][] => {
  const nonEmptyEntries = Object.entries(entriesByEnv).filter(([, entries]) => entries.length > 0);

  // reports without a per-environment breakdown: nothing is environment specific
  if (!nonEmptyEntries.length) {
    return all.length ? [[DEFAULT_ENVIRONMENT, all]] : [];
  }

  if (!environmentId) {
    return nonEmptyEntries;
  }

  const ownEntries = entriesByEnv[environmentId] ?? [];
  const sharedEntries = environmentId === DEFAULT_ENVIRONMENT ? [] : (entriesByEnv[DEFAULT_ENVIRONMENT] ?? []);

  return (
    [
      [environmentId, ownEntries],
      [DEFAULT_ENVIRONMENT, sharedEntries],
    ] as [string, T[]][]
  ).filter(([, entries]) => entries.length > 0);
};

/**
 * Flattens the buckets resolved by {@link globalEntriesByEnv}, e.g. to count them in a tab.
 */
export const flatGlobalEntriesByEnv = <T>(all: T[], entriesByEnv: Record<string, T[]>, environmentId: string): T[] =>
  globalEntriesByEnv(all, entriesByEnv, environmentId).flatMap(([, entries]) => entries);
