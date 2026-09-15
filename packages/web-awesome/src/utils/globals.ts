import { DEFAULT_ENVIRONMENT } from "@allurereport/core-api";

/**
 * Resolves the environment buckets of an environment indexed widget (global attachments, global
 * errors, quality gate results) which have to be rendered for the currently selected environment.
 *
 * Data which isn't bound to a particular environment is indexed under the default one. Such entries
 * aren't environment specific, so they stay visible while a single environment is selected, next to
 * the entries of that environment.
 *
 * @param all - flat list of every entry, used by the reports which have no per-environment breakdown
 * @param entriesByEnv - entries indexed by environment id
 * @param environmentId - currently selected environment id, empty string for "All"
 * @param sharedEnvironmentId - id of the bucket shared by every environment, `null` when the report
 *   has none because it declares the default environment as an environment of its own
 * @returns non-empty buckets as `[environmentId, entries]` pairs, in rendering order
 */
export const globalEntriesByEnv = <T>(
  all: T[],
  entriesByEnv: Record<string, T[]>,
  environmentId: string,
  sharedEnvironmentId: string | null = DEFAULT_ENVIRONMENT,
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
  const sharedEntries =
    sharedEnvironmentId === null || sharedEnvironmentId === environmentId
      ? []
      : (entriesByEnv[sharedEnvironmentId] ?? []);

  return (
    [
      [environmentId, ownEntries],
      [sharedEnvironmentId ?? DEFAULT_ENVIRONMENT, sharedEntries],
    ] as [string, T[]][]
  ).filter(([, entries]) => entries.length > 0);
};

/**
 * `true` when the widget carries a per-environment breakdown, i.e. its entries can be told apart by
 * environment at all. Reports without one have nothing to group, they render a plain list.
 */
export const hasEnvironmentBreakdown = (entriesByEnv: Record<string, unknown[]>): boolean =>
  Object.values(entriesByEnv).some((entries) => entries.length > 0);

/**
 * Flattens the buckets resolved by {@link globalEntriesByEnv}, e.g. to count them in a tab.
 */
export const flatGlobalEntriesByEnv = <T>(
  all: T[],
  entriesByEnv: Record<string, T[]>,
  environmentId: string,
  sharedEnvironmentId: string | null = DEFAULT_ENVIRONMENT,
): T[] => globalEntriesByEnv(all, entriesByEnv, environmentId, sharedEnvironmentId).flatMap(([, entries]) => entries);
