import { cleanup, render, screen } from "@testing-library/preact";
import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vitest";

import { TooltipWrapper } from "@/components/Tooltip";

beforeEach(async () => {
  await story("Tooltip");
});
beforeEach(() => {
  cleanup();
});

describe("TooltipWrapper", () => {
  it("passes the classes to the outer element and to the element around the children", () => {
    render(
      <TooltipWrapper tooltipText="Tooltip" className="outer" triggerClassName="trigger">
        <span>Trigger</span>
      </TooltipWrapper>,
    );

    const trigger = screen.getByText("Trigger").parentElement;

    expect(trigger?.className).toBe("trigger");
    expect(trigger?.parentElement?.className).toBe("outer");
  });
});
