import { appendFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const [reportPath = "osv-results.json"] = process.argv.slice(2);
const scannerOutcome = process.env.OSV_OUTCOME;

const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

const hasFix = (packageResult, group) => {
  const groupIds = new Set(group.ids ?? []);
  return (packageResult.vulnerabilities ?? []).some(
    (vulnerability) =>
      groupIds.has(vulnerability.id) &&
      (vulnerability.affected ?? []).some((affected) =>
        (affected.ranges ?? []).some((range) =>
          (range.events ?? []).some((event) => typeof event.fixed === "string" && event.fixed.length > 0),
        ),
      ),
  );
};

if (!existsSync(reportPath)) {
  if (scannerOutcome !== "success") fail("OSV Scanner failed without osv-results.json");
} else {
  let report;
  try {
    report = JSON.parse(await readFile(reportPath, "utf8"));
  } catch (error) {
    fail(`Unable to read OSV results: ${error.message}`);
  }

  if (!process.exitCode) {
    const groups = (report.results ?? []).flatMap((result) =>
      (result.packages ?? []).flatMap((packageResult) => packageResult.groups ?? []),
    );
    if (scannerOutcome !== "success" && groups.length === 0) {
      fail("OSV Scanner failed with no vulnerability groups (scanner error)");
    } else {
      const findings = (report.results ?? []).flatMap((result) =>
        (result.packages ?? []).flatMap((packageResult) =>
          (packageResult.groups ?? []).map((group) => {
            const score = Number(group.max_severity);
            const normalizedScore = Number.isFinite(score) ? score : -1;
            return {
              score: normalizedScore,
              fixable: hasFix(packageResult, group),
              line: `${(group.ids ?? []).join(", ")} CVSS=${group.max_severity ?? "N/A"} ${packageResult.package?.name ?? "?"}@${packageResult.package?.version ?? "?"} (${result.source?.path ?? "?"})`,
            };
          }),
        ),
      );

      const high = findings.filter((finding) => finding.score >= 7 && finding.fixable);
      const unfixedHigh = findings.filter((finding) => finding.score >= 7 && !finding.fixable);
      const unknownFixable = findings.filter((finding) => finding.score < 0 && finding.fixable);
      const unknownUnfixed = findings.filter((finding) => finding.score < 0 && !finding.fixable);
      const other = findings.filter((finding) => finding.score >= 0 && finding.score < 7);
      const summary = [
        "## OSV findings",
        `HIGH/CRITICAL (fixed): ${high.length}`,
        `HIGH/CRITICAL (unfixed, informational): ${unfixedHigh.length}`,
        `Unknown CVSS (fixed): ${unknownFixable.length}`,
        `Unknown CVSS (unfixed, informational): ${unknownUnfixed.length}`,
        `MEDIUM/LOW (informational): ${other.length}`,
      ];
      if (high.length > 0 || unknownFixable.length > 0) {
        summary.push("", ...[...high, ...unknownFixable].map((finding) => finding.line));
      }

      const renderedSummary = summary.join("\n");
      console.log(renderedSummary);
      if (process.env.GITHUB_STEP_SUMMARY) {
        await appendFile(process.env.GITHUB_STEP_SUMMARY, `${renderedSummary}\n`);
      }

      if (unknownFixable.length > 0) {
        fail(`Failing: ${unknownFixable.length} vulnerability group(s) with unknown CVSS and a known fix.`);
      } else if (high.length > 0) {
        fail(`Failing: ${high.length} fixed HIGH/CRITICAL vulnerability group(s) (CVSS >= 7.0).`);
      } else {
        console.log("No vulnerabilities with a known fix at HIGH/CRITICAL (or unknown CVSS).");
      }
    }
  }
}
