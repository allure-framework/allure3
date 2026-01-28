import type {
  ErrorCategoriesConfig,
  ErrorCategoriesMode,
  ErrorCategoryInput,
  ErrorCategoryNormalized,
  Matcher,
  ObjectMatcher,
} from "@allurereport/core-api";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const hasCompatKeys = (c: ErrorCategoryInput): boolean =>
  c.matchedStatuses !== undefined ||
  c.messageRegex !== undefined ||
  c.traceRegex !== undefined ||
  c.flaky !== undefined;

export type NormalizedErrorCategoriesBundle = {
  mode: ErrorCategoriesMode;
  categories: ErrorCategoryNormalized[];
};

const normalizeRules = (rules: Matcher[]): ErrorCategoryNormalized[] => {
  if (!Array.isArray(rules)) {
    throw new Error("errorCategories.rules must be an array");
  }

  return rules.map((raw, index) => {
    if (!isPlainObject(raw)) {
      throw new Error(`errorCategories.rules[${index}] must be an object`);
    }
    const c = raw as ErrorCategoryInput;

    if (typeof c.name !== "string" || !c.name.trim()) {
      throw new Error(`errorCategories.rules[${index}].name must be non-empty string`);
    }

    const compat = hasCompatKeys(c);
    const hasMatcher = c.matcher !== undefined;
    const hasMatchers = c.matchers !== undefined;

    if ((hasMatcher || hasMatchers) && compat) {
      throw new Error(`errorCategories.rules[${index}] mixes canonical keys with compatibility keys`);
    }
    if (hasMatcher && hasMatchers) {
      throw new Error(`errorCategories.rules[${index}] has both "matcher" and "matchers"`);
    }

    let matchers: Matcher[];

    if (hasMatcher) {
      matchers = [c.matcher as Matcher];
    } else if (Array.isArray(c.matchers)) {
      matchers = c.matchers;
    } else if (compat) {
      const m: ObjectMatcher = {};
      if (c.matchedStatuses) {
        m.statuses = c.matchedStatuses;
      }
      if (c.messageRegex) {
        m.message = c.messageRegex;
      }
      if (c.traceRegex) {
        m.trace = c.traceRegex;
      }
      if (c.flaky !== undefined) {
        m.flaky = c.flaky;
      }
      matchers = [m];
    } else {
      throw new Error(`errorCategories.rules[${index}] must define matcher/matchers or compatibility keys`);
    }

    if (!matchers.length) {
      throw new Error(`errorCategories.rules[${index}].matchers is empty`);
    }

    for (let i = 0; i < matchers.length; i++) {
      const m = matchers[i];
      const ok = typeof m === "function" || isPlainObject(m);
      if (!ok) {
        throw new Error(`errorCategories.rules[${index}].matchers[${i}] must be object|function`);
      }
    }

    return {
      name: c.name,
      matchers,
      applyTags: Array.isArray(c.applyTags) ? c.applyTags : undefined,
      group: typeof c.group === "string" ? c.group : undefined,
      index,
    };
  });
};

export const normalizeErrorCategoriesConfig = (
  input: ErrorCategoriesConfig | undefined,
): NormalizedErrorCategoriesBundle => {
  if (!isPlainObject(input)) {
    throw new Error("errorCategories must be an array or an object { mode?, rules }");
  }

  const mode = input.mode ?? "first";
  if (mode !== "inclusive" && mode !== "first" && mode !== "groupExclusive") {
    throw new Error('errorCategories.mode must be "inclusive" or "first"');
  }

  return {
    mode,
    categories: normalizeRules(input.rules),
  };
};
