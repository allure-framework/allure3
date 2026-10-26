// @vitest-environment jsdom
import { epic, feature, label, story } from "allure-js-commons";
import { createElement, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { SideNavBrand } from "../src/components/SideNav/SideNavBrand.js";
import { SideNavReportInfo } from "../src/components/SideNav/SideNavReportInfo.js";

vi.mock("@allurereport/web-components", () => ({
  SvgIcon: () => createElement("svg", { "data-testid": "default-logo" }),
  Text: ({ children, ...props }: Record<string, any>) => createElement("span", props, children),
  allureIcons: { reportLogo: "report-logo" },
}));

vi.mock("@/stores", () => ({
  useI18n: () => ({ t: (key: string) => (key === "generated" ? "Generated" : key) }),
}));

const { timestampToDate } = vi.hoisted(() => ({ timestampToDate: vi.fn() }));
vi.mock("@/utils/time", () => ({ timestampToDate }));

beforeEach(async () => {
  await epic("coverage");
  await feature("ui-components");
  await story("side navigation");
  await label("coverage", "ui-components");
});

const container = document.createElement("div");

const show = async (component: () => any, reportOptions: Record<string, unknown> | undefined) => {
  (globalThis as any).allureReportOptions = reportOptions;
  await act(() => render(createElement(component, {}), container));
};

const byTestId = (id: string) => container.querySelector(`[data-testid="${id}"]`);

afterEach(() => {
  render(null, container);
  delete (globalThis as any).allureReportOptions;
  timestampToDate.mockReset();
});

describe("SideNavBrand", () => {
  it("should show the configured report name and logo", async () => {
    await show(SideNavBrand, { reportName: "Nightly run", logo: "logo.png" });

    expect(byTestId("report-name")?.textContent).toBe("Nightly run");
    expect(byTestId("report-logo")?.getAttribute("src")).toBe("logo.png");
    expect(byTestId("default-logo")).toBeNull();
  });

  it("should fall back to the default name and Allure logo", async () => {
    await show(SideNavBrand, { reportName: "  " });

    expect(byTestId("report-name")?.textContent).toBe("Allure Report");
    expect(byTestId("report-logo")).toBeNull();
    expect(byTestId("default-logo")).not.toBeNull();
  });
});

describe("SideNavReportInfo", () => {
  it("should show the generation date with time zone and the Allure version", async () => {
    timestampToDate.mockReturnValue("10/23/2026 at 12:00:00 GMT+03:00");

    await show(SideNavReportInfo, { createdAt: 1_792_746_000_000, allureVersion: "3.22.1" });

    expect(timestampToDate).toHaveBeenCalledWith(
      1_792_746_000_000,
      expect.objectContaining({ timeZoneName: "longOffset" }),
    );
    expect(byTestId("report-created-at")?.textContent).toBe("Generated 10/23/2026 at 12:00:00 GMT+03:00");
    expect(byTestId("report-version")?.textContent).toBe("Allure 3.22.1");
  });

  it("should skip an invalid generation date", async () => {
    await show(SideNavReportInfo, { createdAt: Number.NaN, allureVersion: "3.22.1" });

    expect(timestampToDate).not.toHaveBeenCalled();
    expect(byTestId("report-created-at")).toBeNull();
    expect(byTestId("report-version")?.textContent).toBe("Allure 3.22.1");
  });

  it("should render nothing without report options", async () => {
    await show(SideNavReportInfo, undefined);

    expect(byTestId("report-info")).toBeNull();
  });
});
