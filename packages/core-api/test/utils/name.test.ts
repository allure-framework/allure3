import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { createNameContext, resolveName } from "../../src/utils/expression.js";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("name expressions", () => {
  it("captures environment values and one UTC instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T03:04:05.006Z"));
    vi.stubEnv("ALLURE_NAME_BRANCH", "main");

    const context = createNameContext();
    vi.stubEnv("ALLURE_NAME_BRANCH", "changed");
    vi.setSystemTime(new Date("2027-06-07T08:09:10.000Z"));

    expect(context.env.ALLURE_NAME_BRANCH).toBe("main");
    expect(context.date).toEqual({
      iso: "2026-01-02T03:04:05.006Z",
      isoDate: "2026-01-02",
      year: 2026,
      month: 1,
      day: 2,
      unixMs: Date.parse("2026-01-02T03:04:05.006Z"),
    });
  });

  it.each([undefined, "Nightly report"])("preserves literal name %j", (name) => {
    const context = createNameContext();

    const resolved = resolveName(name, "reportName", context);

    expect(resolved).toBe(name);
  });

  it("resolves a name from the captured environment and date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T03:04:05.006Z"));
    vi.stubEnv("ALLURE_NAME_BRANCH", "main");
    const context = createNameContext();

    const resolved = resolveName("${{ env.ALLURE_NAME_BRANCH + ' / ' + date.isoDate }}", "reportName", context);

    expect(resolved).toBe("main / 2026-01-02");
  });
});
