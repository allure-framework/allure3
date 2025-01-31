/**
 * A symbol to make a unique type.
 */
const unvalidated = Symbol("unvalidated");

/**
 * This type serves a purpose similar to `unknown` but it keeps the underlying type available for future inferences.
 *
 * The type is contravariant on T: if `T extends U` then `Unvalidated<U> extends Unvalidated<T>`. That allows
 * passing supertypes to an ensureX function (e.g., passing `string | number` to `ensureString`).
 */
export type Unvalidated<T> = { [unvalidated]: (_: T) => never } | undefined;

/**
 * Represents a (partially) validated type.
 * If `T` is a primitive type, the resulting type is just `T` (i.e., `ShallowValid<string>` is `string`).
 * If `T` is an aggregate type, the resulting type is an aggregate of the same shape as `T` but consisting of
 * unvalidated elements (i.e., `ShallowValid<string[]>` is `Unvalidated<string>[]`).
 */
export type ShallowValid<T> = T extends object
  ? T extends (...v: any[]) => any
    ? T
    : {
        [k in keyof T]: T[k] extends Unvalidated<infer U> ? Unvalidated<U> : Unvalidated<T[k]>;
      }
  : T;

export type ParsingTypeGuard<T> = (value: Unvalidated<T> | ShallowValid<T>) => value is ShallowValid<T>;

export type NestedTypeGuards<T> = T extends object
  ? T extends (...v: any[]) => any
    ? never
    : {
        [k in keyof T]: T[k] extends Unvalidated<infer U> ? NestedTypeGuards<U> : NestedTypeGuards<T[k]>;
      }
  : (value: Unvalidated<T> | T) => value is T;

/**
 * Applies a type guard to an unvalidated value. If the type guard returns `true`, reveals the value. Otherwise,
 * returns `undefined`.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<string> = JSON.parse('"foo"');
 * console.log(check(unvalidated, isString)?.toUpperCase()); // prints FOO
 * ```
 */
export const check = <T>(value: Unvalidated<T>, guard: ParsingTypeGuard<T>): ShallowValid<T> | undefined =>
  guard(value) ? value : undefined;

/**
 * A type guard to check boolean values.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<boolean> = JSON.parse("true");
 * if (isBoolean(unvalidated)) {
 *   const value: boolean = unvalidated;
 * }
 * ```
 */
export const isBoolean: ParsingTypeGuard<boolean> = (value) => typeof value === "boolean";

/**
 * A type guard to check string values.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<string> = JSON.parse('"foo"');
 * if (isString(unvalidated)) {
 *   const value: string = unvalidated;
 * }
 * ```
 */
export const isString: ParsingTypeGuard<string> = (value) => typeof value === "string";

/**
 * A type guard to check numeric values.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<number> = JSON.parse("10");
 * if (isNumber(unvalidated)) {
 *   const value: number = unvalidated;
 * }
 * ```
 */
export const isNumber: ParsingTypeGuard<number> = (value) => typeof value === "number";

/**
 * A type guard to check literal values.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<"foo" | "bar"> = JSON.parse('"foo"');
 * if (isLiteral(unvalidated, ["foo", "bar"])) {
 *   const value: "foo" | "bar" = unvalidated;
 * }
 * ```
 */
export const isLiteral = <const L extends readonly any[]>(
  value: Unvalidated<L[number]>,
  literals: L,
): value is ShallowValid<L[number]> => literals.includes(value);

/**
 * A type guard to check arrays and tuples.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<string[]> = JSON.parse('["foo", "bar"]');
 * if (isArray(unvalidated)) {
 *   const value: ShallowValid<string[]> = unvalidated; // `value` is an array of unvalidated strings.
 * }
 * ```
 */
export const isArray = <T extends any[]>(value: Unvalidated<T> | ShallowValid<T>): value is ShallowValid<T> =>
  Array.isArray(value);

/**
 * A type guard to check objects (except arrays/tuples).
 * @see isArray for arrays and tuples.
 * @example
 * ```ts
 * type TObj = { foo: string };
 * const unvalidated: Unvalidated<TObj> = JSON.parse('{ "foo": "bar" }');
 * if (isObject(unvalidated)) {
 *   const value: ShallowValid<TObj> = unvalidated; // the type of `value` is `{ foo: Unvalidated<string> }`.
 * }
 * ```
 */
export const isObject = <T extends object>(
  value: T extends any[] ? never : Unvalidated<T> | ShallowValid<T>,
): value is T extends any[] ? never : ShallowValid<T> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Checks a value to be `true` or `false`. If that's the case, returns the value as is. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<boolean> = JSON.parse("true");
 * const value: boolean = ensureBoolean(unvalidated) ?? false;
 * ```
 */
export const ensureBoolean = (value: Unvalidated<boolean>) => check(value, isBoolean);

/**
 * Checks if a value is a number. If that's the case, returns the value as is. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<number> = JSON.parse("1");
 * const value: number = ensureNumber(unvalidated) ?? 0;
 * ```
 */
export const ensureNumber = (value: Unvalidated<number>) => check(value, isNumber);

/**
 * Checks if a value is a string. If that's the case, returns the value as is. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<string> = JSON.parse('"foo"');
 * const value: string = ensureString(unvalidated) ?? "<fallback>";
 * ```
 */
export const ensureString = (value: Unvalidated<string>): string | undefined => check(value, isString);

/**
 * Checks if a value is one of the provided literals. If that's the case, returns the value as is. Otherwise, returns
 * `undefined`.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<"foo" | "bar" | number> = JSON.parse('"foo"');
 * const value: "foo" | "bar" | undefined = ensureLiteral(unvalidated, ["foo", "bar"]);
 * ```
 */
export const ensureLiteral = <const L extends readonly any[]>(
  value: Unvalidated<L[number]>,
  literals: L,
): L[number] | undefined => {
  if (isLiteral(value, literals)) {
    return value;
  }
};

/**
 * Checks if a value is an array or a tuple. If that's the case, returns the value but marks the elements as unvalidated.
 * Otherwise, returns `undefined`.
 * @example
 * ```ts
 * type TArr = [string, number];
 * const unvalidated: Unvalidated<TArr> = JSON.parse('["foo", 1]');
 * const value: ShallowValid<TArr> | undefined = ensureArray(unvalidated); // the type of `value` is `[Unvalidated<string>, Unvalidated<number>] | undefined`.
 * ```
 */
export const ensureArray = <T extends any[]>(value: Unvalidated<T>) => check(value, isArray<T>);

/**
 * If the value is an array, returns an array of shallowly validated items. Otherwise, returns an empty array.
 * @param elementGuard a type guard to filter out invalid array items.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<number[]> = JSON.parse("[1, 2, 3]");
 * for (const n of ensureArrayWithItems(unvalidated, isNumber)) {
 *   // n is number here
 * }
 * ```
 */
export const ensureArrayWithItems = <T>(value: Unvalidated<T[]>, elementGuard: ParsingTypeGuard<T>) =>
  (ensureArray(value) ?? []).filter(elementGuard) as ShallowValid<T>[];

/**
 * Checks if a value is a non-null object that is also neither an array nor a tuple. If that's the case, returns the
 * value and marks all the property values as unvalidated. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * type TObj = {
 *   foo: string;
 *   bar: number;
 * };
 * const unvalidated: Unvalidated<TObj> = JSON.parse('{ "foo": "foo", "bar": 1 }');
 * const value: ShallowValid<TObj> | undefined = ensureObject(unvalidated); // the type of `value` is `{ foo: Unvalidated<string>; bar: Unvalidated<number> }`.
 * ```
 */
export const ensureObject = <T extends object>(
  value: T extends any[] ? never : Unvalidated<T>,
): ShallowValid<T> | undefined => {
  if (isObject<T>(value)) {
    return value;
  }
};

/**
 * If a value is a number, returns its integer part. Otherwise, if the value is a string representing an integer number,
 * returns the result of `parseInt(x, 10)`. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const unvalidated: Unvalidated<string | number> = JSON.parse('"1"');
 * const value: number = ensureInt(unvalidated) ?? 0;
 * ```
 */
export const ensureInt = (value: Unvalidated<number> | Unvalidated<string> | number | string) => {
  if (typeof value === "number") {
    return Math.floor(value);
  }

  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
};
