import { describe, expect, it } from "vitest";

import type { ReportContext } from "../src/reportContext.js";
import { renderReportSummaryMarkdown } from "../src/reportMarkdown.js";

const context = (overrides: Partial<ReportContext> = {}): ReportContext => ({
  reports: [],
  totals: {
    stats: {
      failed: 0,
      broken: 0,
      passed: 0,
      skipped: 0,
      unknown: 0,
      total: 0,
    },
    flags: {
      new: 0,
      flaky: 0,
      retry: 0,
    },
    resolutions: {
      issues: 0,
      muted: 0,
      accepted: 0,
    },
    duration: 0,
  },
  environments: [],
  artifacts: [],
  ...overrides,
});

describe("report markdown", () => {
  it("renders an aggregate summary table grouped by environments and report links below the table", () => {
    const markdown = renderReportSummaryMarkdown(
      context({
        reports: [
          {
            name: "Awesome report",
            plugin: "Awesome",
            remoteHref: "https://example.org/awesome",
            stats: { total: 128989, passed: 128900, failed: 39, broken: 25, skipped: 16, unknown: 9 },
            status: "failed",
            duration: 141_000,
          },
          {
            name: "Classic report",
            plugin: "Classic",
            remoteHref: "https://example.org/classic",
            stats: { total: 128989, passed: 128900, failed: 39, broken: 25, skipped: 16, unknown: 9 },
            status: "failed",
            duration: 141_000,
          },
          {
            name: "Launch",
            plugin: "TestOps",
            remoteHref: "https://testops.example.org/launch/1",
            stats: { total: 128989, passed: 128900, failed: 39, broken: 25, skipped: 16, unknown: 9 },
            status: "failed",
            duration: 141_000,
          },
        ],
        totals: {
          stats: { total: 128989, passed: 128900, failed: 39, broken: 25, skipped: 16, unknown: 9 },
          flags: { new: 128, flaky: 0, retry: 1 },
          resolutions: { issues: 2, muted: 1, accepted: 1 },
          duration: 141_000,
        },
        environments: [
          {
            name: "Chrome on Ubuntu",
            stats: { total: 64000, passed: 63950, failed: 30, broken: 10, skipped: 7, unknown: 3 },
            flags: { new: 60, flaky: 0, retry: 1 },
            duration: 70_000,
          },
          {
            name: "Firefox on Windows",
            stats: { total: 64989, passed: 64950, failed: 9, broken: 15, skipped: 9, unknown: 6 },
            flags: { new: 68, flaky: 0, retry: 0 },
            duration: 71_000,
          },
        ],
        artifacts: [
          { name: "linux dump", path: "allure-results-linux.zip" },
          { name: "runtime attachment", path: "logs/stage.log" },
        ],
      }),
    );

    expect(markdown).toBe(`# Allure Report Summary

| &nbsp;&nbsp;&nbsp;&nbsp; | Scope | Duration | Stats | Resolutions | New | Flaky | Retry |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <img src="https://allurecharts.qameta.workers.dev/pie?passed=128900&failed=39&broken=25&skipped=16&unknown=9&size=32" width="28px" height="28px" />&nbsp;&nbsp;&nbsp;&nbsp; | All tests | 2m 21s | <img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" width="8" height="8" />&#8288;&nbsp;128900<br><img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" width="8" height="8" />&#8288;&nbsp;39<br><img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" width="8" height="8" />&#8288;&nbsp;25<br><img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" width="8" height="8" />&#8288;&nbsp;16<br><img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" width="8" height="8" />&#8288;&nbsp;9 | Issues: 2<br>Muted: 1<br>Accepted: 1 | 128 | 0 | 1 |
| <img src="https://allurecharts.qameta.workers.dev/pie?passed=63950&failed=30&broken=10&skipped=7&unknown=3&size=32" width="28px" height="28px" />&nbsp;&nbsp;&nbsp;&nbsp; | Chrome on Ubuntu | 1m 10s | <img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" width="8" height="8" />&#8288;&nbsp;63950<br><img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" width="8" height="8" />&#8288;&nbsp;30<br><img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" width="8" height="8" />&#8288;&nbsp;10<br><img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" width="8" height="8" />&#8288;&nbsp;7<br><img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" width="8" height="8" />&#8288;&nbsp;3 |  | 60 | 0 | 1 |
| <img src="https://allurecharts.qameta.workers.dev/pie?passed=64950&failed=9&broken=15&skipped=9&unknown=6&size=32" width="28px" height="28px" />&nbsp;&nbsp;&nbsp;&nbsp; | Firefox on Windows | 1m 11s | <img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" width="8" height="8" />&#8288;&nbsp;64950<br><img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" width="8" height="8" />&#8288;&nbsp;9<br><img alt="Broken tests" src="https://allurecharts.qameta.workers.dev/dot?type=broken&size=8" width="8" height="8" />&#8288;&nbsp;15<br><img alt="Skipped tests" src="https://allurecharts.qameta.workers.dev/dot?type=skipped&size=8" width="8" height="8" />&#8288;&nbsp;9<br><img alt="Unknown tests" src="https://allurecharts.qameta.workers.dev/dot?type=unknown&size=8" width="8" height="8" />&#8288;&nbsp;6 |  | 68 | 0 | 0 |

**Reports:** <a href="https://example.org/awesome">Awesome</a>, <a href="https://example.org/classic">Classic</a>

**TestOps:** <a href="https://testops.example.org/launch/1">TestOps</a>

<details>
<summary>Artifacts used (2)</summary>

| Name | Path |
| --- | --- |
| linux dump | allure-results-linux.zip |
| runtime attachment | logs/stage.log |

</details>
`);
  });

  it("renders filtered reports as separate rows because their statistics may differ", () => {
    const markdown = renderReportSummaryMarkdown(
      context({
        reports: [
          {
            name: "Allure report",
            plugin: "Awesome",
            remoteHref: "https://example.org/all",
            stats: { total: 10, passed: 10 },
            status: "passed",
            duration: 10,
          },
          {
            name: "Smoke report",
            plugin: "Awesome",
            remoteHref: "https://example.org/smoke",
            stats: { total: 2, passed: 1, failed: 1 },
            status: "failed",
            duration: 20,
            filtered: true,
            newTests: ["1"],
          },
        ],
        totals: {
          stats: { total: 10, passed: 10, failed: 0, broken: 0, skipped: 0, unknown: 0 },
          flags: { new: 1, flaky: 0, retry: 0 },
          resolutions: { issues: 0, muted: 0, accepted: 0 },
          duration: 10,
        },
      }),
    );

    expect(markdown).toContain('**Reports:** <a href="https://example.org/all">Awesome</a>');
    expect(markdown).toContain("**Filtered Reports**");
    expect(markdown).toContain(
      `| <img src="https://allurecharts.qameta.workers.dev/pie?passed=1&failed=1&broken=0&skipped=0&unknown=0&size=32" width="28px" height="28px" />&nbsp;&nbsp;&nbsp;&nbsp; | Smoke report | 20ms | <img alt="Passed tests" src="https://allurecharts.qameta.workers.dev/dot?type=passed&size=8" width="8" height="8" />&#8288;&nbsp;1<br><img alt="Failed tests" src="https://allurecharts.qameta.workers.dev/dot?type=failed&size=8" width="8" height="8" />&#8288;&nbsp;1 | 1 | 0 | 0 |`,
    );
    expect(markdown).toContain('**Reports:** <a href="https://example.org/smoke">Awesome</a>');
  });

  it("can render flag counters as platform-provided links", () => {
    const markdown = renderReportSummaryMarkdown(
      context({
        reports: [
          {
            name: "Awesome report",
            plugin: "Awesome",
            remoteHref: "https://example.org/awesome",
            stats: { total: 10, passed: 10 },
            status: "passed",
            duration: 10,
          },
          {
            name: "Smoke report",
            plugin: "Awesome",
            remoteHref: "https://example.org/smoke",
            stats: { total: 2, passed: 1, failed: 1 },
            status: "failed",
            duration: 20,
            filtered: true,
            newTests: ["1"],
            retryTests: ["2"],
          },
        ],
        totals: {
          stats: { total: 10, passed: 10, failed: 0, broken: 0, skipped: 0, unknown: 0 },
          flags: { new: 1, flaky: 1, retry: 1 },
          resolutions: { issues: 0, muted: 0, accepted: 0 },
          duration: 10,
        },
      }),
      {
        getFlagHref: (flag, row) => {
          if (flag === "flaky") {
            return "javascript:alert(1)";
          }

          return `https://example.org/${row.kind}/${flag}?scope=${encodeURIComponent(row.name)}`;
        },
      },
    );

    expect(markdown).toContain('<a href="https://example.org/total/new?scope=All%20tests">1</a>');
    expect(markdown).toContain('<a href="https://example.org/total/retry?scope=All%20tests">1</a>');
    expect(markdown).toContain('<a href="https://example.org/report/new?scope=Smoke%20report">1</a>');
    expect(markdown).toContain('<a href="https://example.org/report/retry?scope=Smoke%20report">1</a>');
    expect(markdown).toContain(" | 1 | ");
    expect(markdown).not.toContain("javascript:alert");
  });

  it("does not render a pie chart for empty statistics", () => {
    const markdown = renderReportSummaryMarkdown(context());

    expect(markdown).not.toContain("https://allurecharts.qameta.workers.dev/pie");
  });

  it("escapes untrusted markdown and html while keeping safe links clickable", () => {
    const markdown = renderReportSummaryMarkdown(
      context({
        reports: [
          {
            name: "unsafe",
            plugin: "A | <script>",
            remoteHref: "javascript:alert(1)",
            stats: { total: 1, passed: 1 },
            status: "passed",
            duration: 1,
          },
        ],
        totals: {
          stats: { total: 1, passed: 1, failed: 0, broken: 0, skipped: 0, unknown: 0 },
          flags: { new: 0, flaky: 0, retry: 0 },
          resolutions: { issues: 0, muted: 0, accepted: 0 },
          duration: 1,
        },
        environments: [
          {
            name: "Ubuntu | <script>",
            stats: { total: 1, passed: 1, failed: 0, broken: 0, skipped: 0, unknown: 0 },
            flags: { new: 0, flaky: 0, retry: 0 },
            duration: 1,
          },
        ],
        artifacts: [{ name: "a | b", path: "<path>" }],
      }),
    );

    expect(markdown).toContain("Ubuntu &#124; &lt;script&gt;");
    expect(markdown).toContain("**Reports:** A | &lt;script&gt;");
    expect(markdown).not.toContain("javascript:alert");
    expect(markdown).toContain("| a &#124; b | &lt;path&gt; |");
  });
});
