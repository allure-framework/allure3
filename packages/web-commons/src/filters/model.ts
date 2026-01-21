export type FieldFilter<T extends string = string> = {
  type: "field";
  value: Field<T>;
  logicalOperator?: LogicalOperator;
};

export type FieldFilterGroup<T extends string = string> = {
  type: "group";
  value: Filter<T>[];
  logicalOperator?: LogicalOperator;
};

export type Filter<T extends string = string> = FieldFilter<T> | FieldFilterGroup<T>;

export type StringField<T extends string = string> = {
  key: T;
  value: string;
  strict?: boolean;
  type: "string";
};

export type NumberField<T extends string = string> = {
  key: T;
  value: number;
  strict?: boolean;
  type: "number";
};

export type BooleanField<T extends string = string> = {
  key: T;
  value: boolean;
  strict?: never;
  type: "boolean";
};

export type ArrayField<T extends string = string> = {
  key: T;
  value: string[];
  strict?: boolean;
  type: "array";
};

export type Field<T extends string = string> = StringField<T> | NumberField<T> | BooleanField<T> | ArrayField<T>;

export type LogicalOperator = "AND" | "OR";

export type AqlValueType = "STRING" | "NUMBER" | "BOOLEAN";

export const MAX_ARRAY_FIELD_VALUES = 20;
