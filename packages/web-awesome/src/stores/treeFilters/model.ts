import type { ResolutionCategory, TestStatus, TestStatusTransition } from "@allurereport/core-api";
import type {
  ArrayField,
  BooleanField,
  Field,
  FieldFilter,
  FieldFilterGroup,
  StringField,
} from "@allurereport/web-commons";
import type { ReportTreeLeaf } from "types";

export type Filters = {
  query?: string;
  status?: TestStatus;
  flaky?: boolean;
  retry?: boolean;
  resolution?: ResolutionCategory[];
  transition?: TestStatusTransition[];
  tags?: string[];
  categories?: string[];
};

export type AwesomeFieldFilter = FieldFilter<keyof ReportTreeLeaf>;

export type AwesomeFieldFilterGroup = FieldFilterGroup<keyof ReportTreeLeaf> & {
  fieldKey?: keyof ReportTreeLeaf;
};

export type AwesomeFilterGroupSimple = AwesomeFieldFilterGroup & {
  value: AwesomeFieldFilter[];
};

export type AwesomeFilter = AwesomeFieldFilter | AwesomeFilterGroupSimple;

export type AwesomeField = Field<keyof ReportTreeLeaf>;

export type AwesomeBooleanField = BooleanField<keyof ReportTreeLeaf>;

export type AwesomeStringFieldFilter = AwesomeFieldFilter & {
  value: StringField<keyof ReportTreeLeaf>;
};

export type AwesomeArrayFieldFilter = AwesomeFieldFilter & {
  value: ArrayField<keyof ReportTreeLeaf>;
};

export type AwesomeBooleanFieldFilter = AwesomeFieldFilter & {
  value: AwesomeBooleanField;
};

export type TreeFiltersData = {
  tags: string[];
  categories: string[];
};
