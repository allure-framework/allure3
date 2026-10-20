import { getReportOptions } from "@allurereport/web-commons";
import { cleanup, render, screen } from "@testing-library/preact";
import { epic, feature, label, story } from "allure-js-commons";
import { type Mock, beforeEach, describe, expect, it, vi } from "vite-plus/test";

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("OverviewLink");
  await label("coverage", "ui-components");
});

import { OverviewLink } from "@/components/Header/OverviewLink";

vi.mock("@allurereport/web-components/core", () => ({
  OverviewLink: (props: { href: string; text: string }) => (
    <a href={props.href} data-testid="overview-link">
      {props.text}
    </a>
  ),
}));
vi.mock("@allurereport/web-commons", async (importOriginal) => ({
  ...(await importOriginal()),
  getReportOptions: vi.fn(),
}));
vi.mock("@/stores/locale", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("components > Header > OverviewLink", () => {
  it("should render a link to the root overview when the report belongs to a multi-plugin report", () => {
    (getReportOptions as Mock).mockReturnValue({ overviewHref: "../index.html" });

    render(<OverviewLink />);

    const link = screen.getByTestId("overview-link");

    expect(link.getAttribute("href")).toBe("../index.html");
    expect(link.textContent).toContain("backToOverview");
  });

  it("should render nothing when there is no overview", () => {
    (getReportOptions as Mock).mockReturnValue({});

    const { container } = render(<OverviewLink />);

    expect(container.innerHTML).toBe("");
  });
});
