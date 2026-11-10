import {
  type CategoryDefinition,
  type CategoryMatchingData,
  type CategoryRule,
  type Matcher,
  type ObjectMatcher,
  DEFAULT_ERROR_CATEGORIES,
  DEFAULT_ERROR_CATEGORY_IDS,
  extractErrorMatchingData,
  matchCategoryMatcher,
  normalizeCategoriesConfig,
} from "@allurereport/core-api";
import type { ReportCategory, ReportTestResult } from "@allurereport/plugin-api";
import { categoryMatch } from "@allurereport/plugin-api/internal/report";

import type { ClassicCategory } from "./model.js";

export const NO_MESSAGE_GROUP = "No message";

const DEFAULT_CATEGORY_IDS = new Set<string>(Object.values(DEFAULT_ERROR_CATEGORY_IDS));

/**
 * Allure 2 names of the built-in categories, keyed by the core default category ids
 */
const ALLURE2_DEFAULT_CATEGORY_NAMES: Record<string, { coreName: string; classicName: string }> = {
  [DEFAULT_ERROR_CATEGORY_IDS.productErrors]: {
    coreName: DEFAULT_ERROR_CATEGORIES[0].name,
    classicName: "Product defects",
  },
  [DEFAULT_ERROR_CATEGORY_IDS.testErrors]: {
    coreName: DEFAULT_ERROR_CATEGORIES[1].name,
    classicName: "Test defects",
  },
};

const withAllure2DefaultName = (category: CategoryDefinition): CategoryDefinition => {
  const names = ALLURE2_DEFAULT_CATEGORY_NAMES[category.id];

  return names ? { ...category, name: names.classicName } : category;
};

const isDefaultCategory = (category: CategoryDefinition) => DEFAULT_CATEGORY_IDS.has(category.id);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Whether the matcher is the built-in matcher core adds to a default category: an object matcher
 * with only `statuses`, equal to the statuses of that default category.
 * Compared structurally, so a cloned category config is still recognised.
 */
const isBuiltInDefaultMatcher = (categoryId: string, matcher: Matcher) => {
  const defaultMatcher = DEFAULT_ERROR_CATEGORIES.find(({ id }) => id === categoryId)?.matchers as
    | ObjectMatcher
    | undefined;

  if (!defaultMatcher?.statuses || !isPlainObject(matcher)) {
    return false;
  }

  const keys = Object.keys(matcher);
  const statuses = (matcher as ObjectMatcher).statuses;

  return (
    keys.length === 1 &&
    keys[0] === "statuses" &&
    Array.isArray(statuses) &&
    statuses.length === defaultMatcher.statuses.length &&
    statuses.every((status) => defaultMatcher.statuses!.includes(status))
  );
};

/**
 * Splits config categories into the ones matched before `categories.json` rules and the built-in fallbacks
 * matched after them, as in Allure 2: custom rules first, then the default Product / Test defects.
 * A config rule with a default category id (or named "Product errors" / "Test errors") is merged by core
 * into the default category together with the built-in matcher. Its own matchers are matched first,
 * the built-in matcher stays a fallback under the same category.
 */
const splitConfigCategories = (categories: CategoryDefinition[]) => {
  const userCategories: CategoryDefinition[] = [];
  const defaultCategories: CategoryDefinition[] = [];

  for (const category of categories) {
    if (!isDefaultCategory(category)) {
      userCategories.push(category);
      continue;
    }

    const builtInMatchers = category.matchers.filter((matcher) => isBuiltInDefaultMatcher(category.id, matcher));
    const userMatchers = category.matchers.filter((matcher) => !isBuiltInDefaultMatcher(category.id, matcher));

    if (userMatchers.length) {
      userCategories.push({ ...category, matchers: userMatchers });
    }

    if (builtInMatchers.length) {
      defaultCategories.push(
        userMatchers.length || category.name !== ALLURE2_DEFAULT_CATEGORY_NAMES[category.id]?.coreName
          ? { ...category, matchers: builtInMatchers }
          : withAllure2DefaultName({ ...category, matchers: builtInMatchers }),
      );
    }
  }

  return { userCategories, defaultCategories };
};

/**
 * Wraps a legacy regex so it has to match the whole value, like Java `Pattern.matches()` in Allure 2
 */
const toFullMatchRegex = (regex?: string) => (regex ? `^(?:${regex})$` : regex);

/**
 * Converts legacy Allure 2 `categories.json` rules sharing one name into a category rule.
 * Matching keeps Allure 2 semantics: regexes must match the whole error message and trace in dot-all mode,
 * an empty `matchedStatuses` list matches any status and an invalid regex never matches.
 */
const legacyCategoriesToRule = (id: string, categories: ClassicCategory[]): CategoryRule => ({
  id,
  name: id,
  matchers: categories.map(
    (category) => (data: CategoryMatchingData) =>
      categoryMatch(
        {
          ...category,
          messageRegex: toFullMatchRegex(category.messageRegex),
          traceRegex: toFullMatchRegex(category.traceRegex),
        },
        {
          status: data.status,
          flaky: data.flaky,
          statusMessage: data.message,
          statusTrace: data.trace,
        },
      ),
  ),
});

/**
 * Normalizes legacy `categories.json` rules one category at a time, so an invalid rule is skipped
 * without dropping the valid ones. Rules with the same (trimmed) name are merged into one category.
 */
const normalizeLegacyCategories = (legacyCategories: ClassicCategory[]): CategoryDefinition[] => {
  const rulesByName = new Map<string, ClassicCategory[]>();

  for (const category of legacyCategories) {
    if (typeof category?.name !== "string") {
      continue;
    }

    const name = category.name.trim();

    if (!name) {
      continue;
    }

    rulesByName.set(name, [...(rulesByName.get(name) ?? []), category]);
  }

  return Array.from(rulesByName.entries()).flatMap(([name, categories]) => {
    try {
      return normalizeCategoriesConfig([legacyCategoriesToRule(name, categories)]).filter(
        (category) => !isDefaultCategory(category),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Can't apply category ${JSON.stringify(name)} from categories.json`, err);
      return [];
    }
  });
};

/**
 * Resolves the categories used by the classic report, in matching order:
 * 1. categories from the report config (`categories` in allurerc), including the own matchers of config overrides
 *    of the default categories, which keep the name written in the config;
 * 2. legacy Allure 2 `categories.json` rules from the results directories;
 * 3. built-in Product defects (failed) and Test defects (broken) fallbacks, shown with their Allure 2 names
 *    unless the config renamed them.
 *
 * When categories are disabled in the config (`categories: false`), no categories are applied.
 */
export const resolveClassicCategories = (
  configCategories: CategoryDefinition[] | undefined,
  legacyCategories: ClassicCategory[] = [],
): CategoryDefinition[] => {
  const normalizedConfigCategories = configCategories ?? normalizeCategoriesConfig(undefined);

  if (!normalizedConfigCategories.length) {
    return [];
  }

  const { userCategories, defaultCategories } = splitConfigCategories(normalizedConfigCategories);
  const userCategoryIds = new Set(userCategories.map(({ id }) => id));
  const legacy = normalizeLegacyCategories(legacyCategories).filter(({ id }) => !userCategoryIds.has(id));

  return [...userCategories, ...legacy, ...defaultCategories];
};

/**
 * Whether the category is a built-in Product / Test defects fallback: it only has the built-in status matcher
 */
const isFallbackCategory = (category: CategoryDefinition) =>
  isDefaultCategory(category) &&
  category.matchers.length > 0 &&
  category.matchers.every((matcher) => isBuiltInDefaultMatcher(category.id, matcher));

/**
 * Returns the categories the test result belongs to, as they are stored in the test result data.
 * As in Allure 2 (unlike the first-match rule of core `matchCategory` used by the awesome report),
 * a test result gets every matching category from the config and `categories.json`, in matching order.
 * The built-in Product / Test defects fallbacks apply only when none of them matched.
 * Hidden categories are left out; a matching hidden category still disables the fallbacks.
 */
export const matchClassicCategories = (
  categories: CategoryDefinition[],
  tr: Pick<ReportTestResult, "status" | "labels" | "error" | "flaky" | "duration" | "transition" | "environment">,
): ReportCategory[] => {
  const data = extractErrorMatchingData(tr);
  const matches = (category: CategoryDefinition) =>
    category.matchers.some((matcher) => matchCategoryMatcher(matcher, data));
  let matched = categories.filter((category) => !isFallbackCategory(category) && matches(category));

  if (!matched.length) {
    const fallback = categories.find((category) => isFallbackCategory(category) && matches(category));

    matched = fallback ? [fallback] : [];
  }

  const result = new Map<string, ReportCategory>();

  for (const category of matched) {
    if (!category.hide && !result.has(category.id)) {
      result.set(category.id, { id: category.id, name: category.name });
    }
  }

  return Array.from(result.values());
};

/**
 * Prepares test results for the Allure 2 like categories tree: category -> error message -> test.
 * A test result with several categories is shown under each of them.
 * Test results without a category are left out; a missing error message is grouped under "No message".
 */
export const toCategoriesTreeItems = (tests: ReportTestResult[]): ReportTestResult[] =>
  tests
    .filter((test) => !test.isRetry && (test.categories?.length ?? 0) > 0)
    .map((test) => ({
      ...test,
      error: {
        ...test.error,
        message: test.error?.message?.trim() ? test.error.message : NO_MESSAGE_GROUP,
      },
    }));
