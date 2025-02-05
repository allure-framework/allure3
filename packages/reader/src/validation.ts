// eslint-disable-next-line @typescript-eslint/no-unused-vars
const unknownKey = Symbol("This must be an Unknown<T>");

/**
 * Indicates that the value came from an unreliable source and can't be used without checking its validity.
 * Behaves similar to the built-in `unknown` type but keeps the underlying type to be inferred automatically.
 * Use guard functions (e.g., `isString`), or ensure functions (e.g., `ensureString`) to reveal the value.
 */
export type Unknown<T> = typeof unknownKey | ShallowKnown<T> | undefined | null;

/**
 * Returns primitive types and functions as is.
 * For object types, returns a new object type with its property types marked as `Unknown`.
 * This type is distributive.
 * @example
 * ```ts
 * type ArrayOfUnknownStrings = ShallowKnown<string[]>; // Unknown<string>[]
 * type TupleOfUnknownStringAndNumber = ShallowKnown<[string, number]>; // [Unknown<string>, Unknown<number>]
 * type ObjectWithUnknownName = ShallowKnown<{ name: string }>; // { name: Unknown<string> }
 * ```
 */
export type ShallowKnown<T> = T extends object
  ? T extends (...v: any[]) => any
    ? T
    : { [key in keyof T]: Unknown<T[key]> }
  : T;

/**
 * Returns the first type argument if it's a super-type of the second one. Othwewise, returns `never`.
 * This type is not distributive.
 */
export type IsSuper<SuperType, SubType> = [SubType] extends [never]
  ? never
  : [SubType] extends [SuperType]
    ? SuperType
    : never;

/**
 * Returns the second type argument if it's a sub-type of the first one. Otherwise, returns `never`.
 * This type is not distributive.
 */
export type Narrow<SuperType, SubType> = [SubType] extends [never]
  ? never
  : [SubType] extends [SuperType]
    ? SubType
    : never;

/**
 * Infers the element type of an array. This type is distributive.
 */
export type ArrayElement<T> = T extends readonly (infer E)[] ? (E[] extends T ? E : never) : never;

/**
 * Returns the argument as is if it's an object (but not array), all properties of which are of the same type.
 */
export type IsHomogeneousObject<T> = T extends object
  ? T extends readonly any[]
    ? never
    : T extends { [key in keyof T]: infer U }
      ? { [key in keyof T]: U } extends T
        ? T
        : never
      : never
  : never;

/**
 * If the argument is an object (but not array), all properties of which are of the same type, returns the object
 * type with the same set of proeprties but marks them as optional and change the value type to the second argument.
 */
export type NarrowHomogeneousObject<T, R> = T extends object
  ? T extends readonly any[]
    ? never
    : T extends { [key in keyof T]: infer U }
      ? { [key in keyof T]: U } extends T
        ? { [key in keyof T]?: R }
        : never
      : never
  : never;

/**
 * If the argument is an object (but not array), all properties of which are of the same type, returns the property
 * type.
 */
export type HomogeneousObjectItem<T> = T extends object
  ? T extends readonly any[]
    ? never
    : T extends { [key in keyof T]: infer U }
      ? { [key in keyof T]: U } extends T
        ? U
        : never
      : never
  : never;

/**
 * Unites the second and the forth arguments depending on their condition types, which are the first and the second
 * arguments respectively.
 */
export type ConditionalUnion<CA, A, CB, B> = [CA] extends [never] ? B : [CB] extends [never] ? A : A | B;

/**
 * A type guard to check string values.
 * @example
 * ```ts
 * const raw: Unknown<string> = JSON.parse('"foo"');
 * if (isString(raw)) {
 *   const value: string = raw;
 * }
 * ```
 */
export const isString = <T>(value: Unknown<IsSuper<T, string>>): value is ShallowKnown<Narrow<T, string>> =>
  typeof value === "string";

/**
 * A type guard to check numeric values.
 * @example
 * ```ts
 * const raw: Unknown<number> = JSON.parse("101");
 * if (isNumber(raw)) {
 *   const value: number = raw;
 * }
 * ```
 */
export const isNumber = <T>(value: Unknown<IsSuper<T, number>>): value is ShallowKnown<Narrow<T, number>> =>
  typeof value === "number";

/**
 * A type guard to check boolean values.
 * @example
 * ```ts
 * const raw: Unknown<boolean> = JSON.parse("true");
 * if (isBoolean(raw)) {
 *   const value: boolean = raw;
 * }
 * ```
 */
export const isBoolean = <T>(value: Unknown<IsSuper<T, boolean>>): value is ShallowKnown<Narrow<T, boolean>> =>
  typeof value === "boolean";

/**
 * A type guard to check array values.
 * @example
 * ```ts
 * const raw: Unknown<number[]> = JSON.parse("[1, 2, 3]");
 * if (isArray(raw)) {
 *   const value: ShallowKnown<number[]> = raw; // raw is Unknown<number>[] here
 * }
 * ```
 */
export const isArray = <T>(
  value: Unknown<IsSuper<T, Extract<T, readonly any[]>>>,
): value is ShallowKnown<Extract<Narrow<T, Extract<T, readonly any[]>>, readonly any[]>> => Array.isArray(value);

/**
 * A type guard to check object values (except arrays and tuples; for those, use `isArray`.
 * @example
 * ```ts
 * const raw: Unknown<{ name: string }> = JSON.parse('{ "name": "foo" }');
 * if (isArray(raw)) {
 *   const value: ShallowKnown<{ name: string }> = raw; // raw is { name: Unknown<string> } here
 * }
 * ```
 */
export const isObject = <T>(
  value: Unknown<IsSuper<T, Extract<Exclude<T, readonly any[]>, object>>>,
): value is ShallowKnown<Narrow<T, Extract<Exclude<T, readonly any[]>, object>>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A type guard to check literal types.
 * @example
 * ```ts
 * const raw: Unknown<"foo" | "bar"> = JSON.parse('"foo"');
 * if (isLiteral(raw, ["foo", "bar"])) {
 *   const value: "foo" | "bar" = raw;
 * }
 * ```
 */
export const isLiteral = <T, const L extends readonly any[]>(
  value: Unknown<IsSuper<T, L[number]>>,
  literals: L,
): value is ShallowKnown<L[number]> => literals.includes(value);

/**
 * If the value is a string, returns it as is. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const raw: Unknown<string> = JSON.parse('"foo"');
 * const value: string = ensureString(raw) ?? "default";
 * ```
 */
export const ensureString = <T>(value: Unknown<T>): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * If the value is a number, returns it as is. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const raw: Unknown<number> = JSON.parse("1");
 * const value: number = ensureNumber(raw) ?? -1;
 * ```
 */
export const ensureNumber = <T>(value: Unknown<T>): number | undefined =>
  typeof value === "number" ? value : undefined;

/**
 * If the value is a boolean, returns it as is. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const raw: Unknown<boolean> = JSON.parse("true");
 * const value: boolean = ensureBoolean(raw) ?? false;
 * ```
 */
export const ensureBoolean = <T>(value: Unknown<T>): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

/**
 * If the value is a number, returns its integer part. Otherwise, if the value is a string, parses it as a base 10
 * integer. If the parsing succeeds, returns the parsed integer. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const raw: Unknown<string | number> = JSON.parse('"123"');
 * const value: number = ensureInt(raw) ?? -1;
 * ```
 */
export const ensureInt = <T>(value: Unknown<T>): number | undefined => {
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

/**
 * If the value is an array or tuple, marks it as `ShallowKnown` and returns as is. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const raw: Unknown<number[]> = JSON.parse("[1, 2, 3]");
 * const value: ShallowKnown<number[]> = ensureArray(raw) ?? []; // value is Unknown<number>[]
 * ```
 */
export const ensureArray = <T>(value: Unknown<IsSuper<T, Extract<T, readonly any[]>>>) =>
  isArray(value) ? value : undefined;

/**
 * If the value is an object (but not an array or a tuple; for those use `ensureArray`), marks it as `ShallowKnown` and
 * returns it as is. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const raw: Unknown<{ name: string }> = JSON.parse('{ "name": "foo" }');
 * const value: ShallowKnown<{ name: string }> | undefined = ensureObject(raw) ?? []; // value is { name: Unknown<string> } | undefined
 * ```
 */
export const ensureObject = <T>(value: Unknown<IsSuper<T, Extract<Exclude<T, readonly any[]>, object>>>) =>
  isObject(value) ? value : undefined;

/**
 * If the value is one of the provided literals, returns it as it. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const raw: Unknown<"foo" | "bar"> = JSON.parse('"foo"');
 * const value: "foo" | "bar" = ensureLiteral(raw, ["foo", "bar"]) ?? "foo";
 * ```
 */
export const ensureLiteral = <T, const L extends readonly any[]>(value: Unknown<T>, literals: L) =>
  literals.includes(value) ? (value as ShallowKnown<L[number]>) : undefined;

/**
 * If the value is an array, returns a new array with elements of the original array conforming to the provided type
 * guard. Otherwise, returns `undefined`.
 * @example
 * ```ts
 * const raw: Unknown<number[]> = JSON.parse("[1, 2, 3]");
 * const value: number[] = ensureArrayWithItems(raw, isNumber) ?? [];
 * ```
 */
export const ensureArrayWithItems = <T, R extends ShallowKnown<ArrayElement<T>>>(
  value: Unknown<IsSuper<T, Extract<T, ArrayElement<T>[]>>>,
  guard: (v: Unknown<ArrayElement<T>>) => v is R,
): R[] | undefined => ensureArray(value as Unknown<IsSuper<T, Extract<T, readonly any[]>>>)?.filter(guard);

/**
 * If the value is an object (but not an array; for arrays, see `ensureArrayWithItems`), returns a new object of
 * the same shape as the original one but with only proeprties that confirms to the provided type guard.
 * @example
 * ```ts
 * const raw: Unknown<{ name: string }> = JSON.parse('{ "name": "foo" }');
 * const value: { name?: string } | undefined = ensureObjectWithProps(raw, isString);
 * ```
 */
export const ensureObjectWithProps = <T, R extends ShallowKnown<HomogeneousObjectItem<T>>>(
  value: Unknown<IsSuper<T, Extract<T, IsHomogeneousObject<T>>>>,
  guard: (v: Unknown<HomogeneousObjectItem<T>>) => v is R,
): NarrowHomogeneousObject<T, R> | undefined => {
  const obj = ensureObject(value as Unknown<IsSuper<T, Extract<Exclude<T, readonly any[]>, object>>>);
  if (obj) {
    return Object.entries(obj).reduce(
      (a, [k, v]: [string, Unknown<HomogeneousObjectItem<T>>]) => {
        if (guard(v)) {
          (a as any)[k] = v;
        }
        return a;
      },
      {} as NarrowHomogeneousObject<T, R>,
    );
  }
};

/**
 * If the value is an array, returns a new array with elements of the original array conforming to the provided type
 * guard.
 * Otherwise, if the value is an object, returns a new object of the same shape as the original one but with only
 * proeprties that confirms to the provided type guard.
 * @example
 * ```ts
 * const raw: Unknown<{ name: string } | string[]> = JSON.parse('["foo", "bar"]');
 * const value: string[] | { name?: string } | undefined = ensureItems(raw, isString);
 * ```
 */
export const ensureItems = <T, R extends ShallowKnown<HomogeneousObjectItem<T> | ArrayElement<T>>>(
  value: Unknown<IsSuper<T, Extract<T, IsHomogeneousObject<T> | ArrayElement<T>[]>>>,
  guard: (v: Unknown<HomogeneousObjectItem<T> | ArrayElement<T>>) => v is R,
): ConditionalUnion<ArrayElement<T>, R[], IsHomogeneousObject<T>, NarrowHomogeneousObject<T, R>> | undefined => {
  // @ts-ignore
  return ensureArrayWithItems(value, guard) ?? ensureObjectWithProps(value, guard);
};
