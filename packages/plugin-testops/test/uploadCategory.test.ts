import type { CategoryDefinition, Matcher } from "@allurereport/core-api";
import { describe, expect, it } from "vitest";

import type { TestResultWithCategories } from "../src/model.js";
import { toUploadCategory } from "../src/uploadCategory.js";

type CategoryOverrides = Partial<CategoryDefinition>;
type UploadCategoryTr = TestResultWithCategories & {
  id?: string;
  name?: string;
  historyId?: string;
};

const matcherFailed: Matcher = { statuses: ["failed"] };

const mkCategory = (overrides: CategoryOverrides = {}): CategoryDefinition => ({
  id: "product-errors",
  name: "Product errors",
  matchers: [matcherFailed],
  groupBy: [],
  groupByMessage: false,
  groupEnvironments: false,
  expand: false,
  hide: false,
  index: 0,
  ...overrides,
});

const mkTr = (overrides: Partial<UploadCategoryTr> = {}): UploadCategoryTr => ({
  status: "failed",
  labels: [],
  flaky: false,
  transition: undefined,
  environment: undefined,
  error: undefined,
  ...overrides,
});

describe("toUploadCategory", () => {
  it("uses tr.categories id when present", () => {
    const tr = mkTr({
      categories: [{ id: "cat-id", name: "Category Name" }],
    });

    expect(toUploadCategory(tr, [])).toEqual({
      externalId: "cat-id",
      name: "Category Name",
      grouping: undefined,
    });
  });

  it("falls back to tr.categories name when id is missing", () => {
    const tr = mkTr({
      categories: [{ name: "Category Name" }],
    });

    expect(toUploadCategory(tr, [])).toEqual({
      externalId: "Category Name",
      name: "Category Name",
      grouping: undefined,
    });
  });

  it("uses grouping from tr.categories when provided", () => {
    const tr = mkTr({
      categories: [
        {
          id: "cat-id",
          name: "Category Name",
          grouping: [{ key: "owner", value: "alice", name: "owner: alice" }],
        },
      ],
    });

    expect(toUploadCategory(tr, [])).toEqual({
      externalId: "cat-id",
      name: "Category Name",
      grouping: [{ key: "owner", value: "alice", name: "owner: alice" }],
    });
  });

  it("builds grouping from context category when tr.categories has no grouping", () => {
    const tr = mkTr({
      id: "tr-id-ctx",
      name: "my test name",
      environment: "foo",
      categories: [{ id: "product-errors", name: "Product errors" }],
    });
    const category = mkCategory({
      groupBy: ["severity"],
      groupEnvironments: true,
    });

    expect(toUploadCategory(tr, [category])).toEqual({
      externalId: "product-errors",
      name: "Product errors",
      grouping: [
        { key: "severity", value: "normal", name: "severity: normal" },
        { key: "historyId", value: "tr-id-ctx", name: "my test name" },
        { key: "environment", value: "foo", name: "environment: foo" },
      ],
    });
  });

  it("returns undefined when context categories are empty", () => {
    expect(toUploadCategory(mkTr(), [])).toBeUndefined();
  });

  it("returns undefined when no context category matches test result", () => {
    const tr = mkTr({ status: "passed" });
    const category = mkCategory();

    expect(toUploadCategory(tr, [category])).toBeUndefined();
  });

  it("builds grouping from built-in and custom selectors", () => {
    const tr = mkTr({
      labels: [
        { name: "severity", value: "critical" },
        { name: "owner", value: "alice" },
        { name: "layer", value: "api" },
        { name: "team", value: "qa" },
      ],
      flaky: true,
      transition: "regressed",
      environment: "prod",
    });
    const category = mkCategory({
      groupBy: ["status", "severity", "owner", "layer", "flaky", "transition", "environment", { label: "team" }],
    });

    expect(toUploadCategory(tr, [category])).toEqual({
      externalId: "product-errors",
      name: "Product errors",
      grouping: [
        { key: "status", value: "failed", name: "status: failed" },
        { key: "severity", value: "critical", name: "severity: critical" },
        { key: "owner", value: "alice", name: "owner: alice" },
        { key: "layer", value: "api", name: "layer: api" },
        { key: "flaky", value: "true", name: "flaky: true" },
        { key: "transition", value: "regressed", name: "transition: regressed" },
        { key: "environment", value: "prod", name: "environment: prod" },
        { key: "team", value: "qa", name: "team: qa" },
      ],
    });
  });

  it("adds message level and uses fallback when message is blank", () => {
    const tr = mkTr({ error: { message: "   " } });
    const category = mkCategory({ groupByMessage: true });

    expect(toUploadCategory(tr, [category])).toEqual({
      externalId: "product-errors",
      name: "Product errors",
      grouping: [{ key: "message", value: "<Empty>", name: "message: No message" }],
    });
  });

  it("adds message level with original message when it is not blank", () => {
    const tr = mkTr({ error: { message: "Timeout while waiting for response" } });
    const category = mkCategory({ groupByMessage: true });

    expect(toUploadCategory(tr, [category])).toEqual({
      externalId: "product-errors",
      name: "Product errors",
      grouping: [
        {
          key: "message",
          value: "Timeout while waiting for response",
          name: "message: Timeout while waiting for response",
        },
      ],
    });
  });

  it("adds historyId and environment levels when groupEnvironments is enabled", () => {
    const tr = mkTr({
      id: "tr-id-1",
      name: "My failed test",
      historyId: "hist-id-1",
      environment: "stage",
    });
    const category = mkCategory({ groupEnvironments: true });

    expect(toUploadCategory(tr, [category])).toEqual({
      externalId: "product-errors",
      name: "Product errors",
      grouping: [
        { key: "historyId", value: "hist-id-1", name: "My failed test" },
        { key: "environment", value: "stage", name: "environment: stage" },
      ],
    });
  });

  it("does not duplicate environment when groupBy already includes environment", () => {
    const tr = mkTr({
      id: "tr-id-2",
      environment: "stage",
    });
    const category = mkCategory({
      groupBy: ["environment"],
      groupEnvironments: true,
    });

    expect(toUploadCategory(tr, [category])).toEqual({
      externalId: "product-errors",
      name: "Product errors",
      grouping: [
        { key: "environment", value: "stage", name: "environment: stage" },
        { key: "historyId", value: "tr-id-2", name: "tr-id-2" },
      ],
    });
  });

  it("uses fallback values for historyId and environment when missing", () => {
    const tr = mkTr({ id: undefined, name: "   ", environment: " " });
    const category = mkCategory({ groupEnvironments: true });

    expect(toUploadCategory(tr, [category])).toEqual({
      externalId: "product-errors",
      name: "Product errors",
      grouping: [
        { key: "historyId", value: "<Empty>", name: "<Empty>" },
        { key: "environment", value: "<Empty>", name: "environment: No environment" },
      ],
    });
  });

  it("falls back to context categories when tr.categories item has no name", () => {
    const tr = mkTr({
      categories: [{ id: "broken-category", name: "" }],
    });

    expect(toUploadCategory(tr, [])).toBeUndefined();
  });
});
