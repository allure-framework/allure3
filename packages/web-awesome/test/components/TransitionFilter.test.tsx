import { render } from "@testing-library/preact";
import { allureId, epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { multipleChoiceFieldFilterMock } = vi.hoisted(() => ({
  multipleChoiceFieldFilterMock: vi.fn(),
}));

vi.mock("@/components/ReportFilters/BaseFilters", () => ({
  MultipleChoiceFieldFilter: (props: unknown) => {
    multipleChoiceFieldFilterMock(props);
    return null;
  },
}));

vi.mock("@allurereport/web-components/core", () => ({
  allureIcons: new Proxy({} as Record<string, string>, {
    get: (_target, key) => String(key),
  }),
}));

vi.mock("@/stores", () => ({
  useI18n: (namespace: string) => ({
    t: (key: string) => `${namespace}:${key}`,
  }),
}));

import { TransitionFilter } from "@/components/ReportFilters/TransitionFilter";
import type { AwesomeFilterGroupSimple } from "@/stores/treeFilters/model";

const emptyGroup: AwesomeFilterGroupSimple = {
  type: "group",
  logicalOperator: "AND",
  fieldKey: "transition",
  value: [],
};

const lastProps = () =>
  multipleChoiceFieldFilterMock.mock.calls.at(-1)?.[0] as {
    options: { key: string; label: string; description: string; icon: string }[];
    fieldKey: string;
    logicalOperator: string;
    strict: boolean;
    counter: boolean;
    label: string;
    testId: string;
    onClear: () => void;
  };

beforeEach(async () => {
  await epic("coverage");
  await feature("filters");
  await story("status-transitions");
  await label("coverage", "status-transitions");
  multipleChoiceFieldFilterMock.mockReset();
});

describe("components > TransitionFilter", () => {
  it("should expose transition options, descriptions, counters, and clear action", async () => {
    await allureId("304048");
    const onChange = vi.fn();
    const group: AwesomeFilterGroupSimple = {
      ...emptyGroup,
      value: [
        {
          type: "field",
          logicalOperator: "OR",
          value: { key: "transition", value: "fixed", type: "string", strict: true },
        },
      ],
    };

    render(<TransitionFilter group={group} onChange={onChange} />);
    const props = lastProps();

    expect(props.options).toEqual([
      { key: "new", icon: "lineAlertsNew", label: "filters:new", description: "filters:description.new" },
      { key: "fixed", icon: "lineAlertsFixed", label: "filters:fixed", description: "filters:description.fixed" },
      {
        key: "regressed",
        icon: "lineAlertsRegressed",
        label: "filters:regressed",
        description: "filters:description.regressed",
      },
      {
        key: "malfunctioned",
        icon: "lineAlertsMalfunctioned",
        label: "filters:malfunctioned",
        description: "filters:description.malfunctioned",
      },
    ]);
    expect(props).toMatchObject({
      fieldKey: "transition",
      logicalOperator: "OR",
      strict: true,
      counter: true,
      label: "filters:transition",
      testId: "transition-filter",
    });

    props.onClear();
    expect(onChange).toHaveBeenCalledWith({ ...group, value: [] });
  });
});
