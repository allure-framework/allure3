import type {
  ErrorCategoriesMode,
  ErrorCategoryNormalized,
  ErrorMatchingData,
  Matcher,
  ObjectMatcher,
} from "@allurereport/core-api";

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const toRegExp = (v: string | RegExp): RegExp => (v instanceof RegExp ? v : new RegExp(v));

const matchObjectMatcher = (m: ObjectMatcher, d: ErrorMatchingData): boolean => {
  if (m.statuses && !m.statuses.includes(d.status)) {
    return false;
  }
  if (m.flaky !== undefined && m.flaky !== d.flaky) {
    return false;
  }

  if (m.labels) {
    for (const [labelName, expected] of Object.entries(m.labels)) {
      const re = toRegExp(expected as any);
      const values = d.labels.filter((l) => l.name === labelName).map((l) => l.value);
      if (!values.some((v) => re.test(v!))) {
        return false;
      }
    }
  }

  if (m.message !== undefined) {
    const re = toRegExp(m.message);
    if (!re.test(d.message ?? "")) {
      return false;
    }
  }

  if (m.trace !== undefined) {
    const re = toRegExp(m.trace);
    if (!re.test(d.trace ?? "")) {
      return false;
    }
  }

  return true;
};

export const matchMatcher = (matcher: Matcher, d: ErrorMatchingData): boolean => {
  if (typeof matcher === "function") {
    return matcher(d);
  }
  if (isPlainObject(matcher)) {
    return matchObjectMatcher(matcher, d);
  }
  return false;
};

// "first"         => at most 1 category (first by config order)
// "inclusive"     => all matched
export const matchCategories = (
  categories: readonly ErrorCategoryNormalized[],
  d: ErrorMatchingData,
  mode: ErrorCategoriesMode = "first",
): ErrorCategoryNormalized[] => {
  if (mode === "inclusive") {
    const inclusiveOut: ErrorCategoryNormalized[] = [];
    for (const c of categories) {
      if (c.matchers.some((m) => matchMatcher(m, d))) {
        inclusiveOut.push(c);
      }
    }
    return inclusiveOut;
  }

  for (const c of categories) {
    if (c.matchers.some((m) => matchMatcher(m, d))) {
      return [c];
    }
  }
  return [];
};
