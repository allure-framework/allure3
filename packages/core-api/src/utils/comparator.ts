import type { Statistic } from "../aggregate.js";
import { statusesList } from "../constants.js";
import type { TestStatus } from "../model.js";

export type SortFunction<T> = () => Comparator<T>;

export type Comparator<T> = (a: T, b: T) => number;

type Value<T, P> = T extends any ? (P extends keyof T ? T[P] : P extends "" ? T : never) : never;

export const reverse = <T>(comparator: Comparator<T>): Comparator<T> => {
  return (a, b) => comparator(b, a);
};

export const nullsLast = <T extends {}>(compare: Comparator<T>): Comparator<T | undefined> => {
  return (a, b) =>
    a === b ? 0 : a === undefined || a === null ? 1 : b === undefined || b === null ? -1 : compare(a, b);
};

export const compareBy = <T extends Record<string, any> = {}, P extends keyof T = keyof T>(
  property: P,
  compare: Comparator<Value<T, P>>,
): Comparator<T> => {
  return nullsLast((a, b) => {
    if (property in a && property in b) {
      return compare(a[property], b[property]);
    }
    return 0;
  });
};

export const andThen = <T>(comparators: Comparator<T>[]): Comparator<T> => {
  return (a, b) => {
    for (const compare of comparators) {
      const res = compare(a, b);
      if (res !== 0) {
        return res;
      }
    }
    return 0;
  };
};

export const alphabetically: SortFunction<string | undefined> = () => nullsLast((a, b) => a.localeCompare(b));
export const ordinal: SortFunction<number | undefined> = () => nullsLast((a, b) => a - b);

export const byStatus: SortFunction<TestStatus | undefined> = () => {
  return nullsLast((a, b) => {
    return statusesList.indexOf(a) - statusesList.indexOf(b);
  });
};
export const byStatistic: SortFunction<Statistic | undefined> = () => {
  const compares = statusesList.map((status) => compareBy<Statistic>(status, reverse(ordinal())));
  return nullsLast(andThen(compares));
};

export const byName: SortFunction<Partial<{ name: string }> | undefined> = () =>
  nullsLast(compareBy("name", alphabetically()));
