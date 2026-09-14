import { render } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  await epic("coverage");
  await feature("filters");
  await story("severity");
  await label("coverage", "filters");
});

const { multipleChoiceFieldFilterMock } = vi.hoisted(() => ({
  multipleChoiceFieldFilterMock: vi.fn(),
}));

vi.mock("@/components/ReportFilters/BaseFilters", () => ({
  MultipleChoiceFieldFilter: (props: unknown) => {
    multipleChoiceFieldFilterMock(props);

    return null;
  },
}));

vi.mock("@allurereport/web-components", () => ({
  allureIcons: new Proxy({} as Record<string, string>, {
    get: (_target, key) => String(key),
  }),
}));

vi.mock("@/stores", () => ({
  useI18n: (namespace: string) => ({
    t: (key: string) => `${namespace}:${key}`,
  }),
}));

import { SeverityFilter } from "@/components/ReportFilters/SeverityFilter";
import type { AwesomeFilterGroupSimple } from "@/stores/treeFilters/model";

const emptyGroup: AwesomeFilterGroupSimple = {
  type: "group",
  logicalOperator: "AND",
  fieldKey: "severity",
  value: [],
};

const lastProps = () =>
  multipleChoiceFieldFilterMock.mock.calls.at(-1)?.[0] as {
    options: { key: string; label: string; icon: string }[];
    fieldKey: string;
    logicalOperator: string;
    strict: boolean;
    label: string;
    testId: string;
    onClear: () => void;
  };

describe("components > SeverityFilter", () => {
  beforeEach(() => {
    multipleChoiceFieldFilterMock.mockReset();
  });

  it("should offer every severity level plus the missing severity option", () => {
    render(<SeverityFilter group={emptyGroup} onChange={vi.fn()} />);

    expect(lastProps().options.map(({ key }) => key)).toEqual([
      "blocker",
      "critical",
      "normal",
      "minor",
      "trivial",
      "none",
    ]);
  });

  it("should label the options from the severity namespace", () => {
    render(<SeverityFilter group={emptyGroup} onChange={vi.fn()} />);

    const { options, label: filterLabel } = lastProps();

    expect(filterLabel).toBe("filters:severity");
    expect(options.map(({ label: optionLabel }) => optionLabel)).toEqual([
      "Severity:blocker",
      "Severity:critical",
      "Severity:normal",
      "Severity:minor",
      "Severity:trivial",
      "Severity:none",
    ]);
  });

  it("should give every option an icon", () => {
    render(<SeverityFilter group={emptyGroup} onChange={vi.fn()} />);

    expect(lastProps().options.every(({ icon }) => Boolean(icon))).toBe(true);
  });

  it("should apply the selected severities with OR", () => {
    render(<SeverityFilter group={emptyGroup} onChange={vi.fn()} />);

    const { fieldKey, logicalOperator, strict } = lastProps();

    expect(fieldKey).toBe("severity");
    expect(logicalOperator).toBe("OR");
    expect(strict).toBe(true);
  });

  it("should reset the whole group when cleared", () => {
    const onChange = vi.fn();
    const group: AwesomeFilterGroupSimple = {
      ...emptyGroup,
      value: [
        {
          type: "field",
          logicalOperator: "OR",
          value: { key: "severity", value: "blocker", type: "string", strict: true },
        },
      ],
    };

    render(<SeverityFilter group={group} onChange={onChange} />);

    lastProps().onClear();

    expect(onChange).toHaveBeenCalledWith({ ...group, value: [] });
  });
});
