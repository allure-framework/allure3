import { cleanup, render, screen } from "@testing-library/preact";
import { story } from "allure-js-commons";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { OverviewLink } from "@/components/OverviewLink";

beforeEach(async () => {
  await story("OverviewLink");
});
beforeEach(() => {
  cleanup();
});

describe("OverviewLink", () => {
  it("renders a link to the overview with the passed label", () => {
    render(<OverviewLink href="../index.html" text="Back to overview" />);

    const link = screen.getByRole("link", { name: "Back to overview" });

    expect(link.getAttribute("href")).toBe("../index.html");
    expect(link.getAttribute("data-testid")).toBe("overview-link");
  });

  it("stays in the same tab", () => {
    render(<OverviewLink href="../index.html" text="Back to overview" />);

    expect(screen.getByRole("link").getAttribute("target")).toBe("_self");
  });
});
