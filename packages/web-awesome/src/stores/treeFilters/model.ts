import type { TestStatus, TestStatusTransition } from "@allurereport/core-api";
import type {
  ArrayField,
  BooleanField,
  Field,
  FieldFilter,
  FieldFilterGroup,
  StringField,
} from "@allurereport/web-commons";
import type { AwesomeTreeLeaf } from "types";

export type Filters = {
  query?: string;
  status?: TestStatus;
  flaky?: boolean;
  retry?: boolean;
  transition?: TestStatusTransition[];
  tags?: string[];
};

export type AwesomeFieldFilter = FieldFilter<keyof AwesomeTreeLeaf>;

export type AwesomeFieldFilterGroup = FieldFilterGroup<keyof AwesomeTreeLeaf> & {
  fieldKey?: keyof AwesomeTreeLeaf;
};

export type AwesomeFilterGroupSimple = AwesomeFieldFilterGroup & {
  value: AwesomeFieldFilter[];
};

export type AwesomeFilter = AwesomeFieldFilter | AwesomeFilterGroupSimple;

export type AwesomeField = Field<keyof AwesomeTreeLeaf>;

export type AwesomeBooleanField = BooleanField<keyof AwesomeTreeLeaf>;

export type AwesomeStringFieldFilter = AwesomeFieldFilter & {
  value: StringField<keyof AwesomeTreeLeaf>;
};

export type AwesomeArrayFieldFilter = AwesomeFieldFilter & {
  value: ArrayField<keyof AwesomeTreeLeaf>;
};

export type AwesomeBooleanFieldFilter = AwesomeFieldFilter & {
  value: AwesomeBooleanField;
};

export type TreeFiltersData = {
  tags: string[];
};
