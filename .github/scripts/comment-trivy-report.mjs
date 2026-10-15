import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

const marker = "<!-- trivy-vulnerability-report -->";
const escapeCell = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");

export default async function commentTrivyReport({ github, context }) {
  let findings;
  if (existsSync("trivy-results.json")) {
    const report = JSON.parse(await readFile("trivy-results.json", "utf8"));
    findings = (report.Results ?? []).flatMap(({ Target, Vulnerabilities = [] }) =>
      Vulnerabilities.map((vulnerability) => ({ ...vulnerability, target: Target })),
    );
  }

  const { owner, repo } = context.repo;
  const issue_number = context.issue.number;
  const { data: comments } = await github.rest.issues.listComments({ owner, repo, issue_number, per_page: 100 });
  const existing = comments.find((comment) => comment.user.type === "Bot" && comment.body.includes(marker));

  if (findings?.length === 0) {
    if (existing) {
      await github.rest.issues.deleteComment({ owner, repo, comment_id: existing.id });
    }
    return;
  }

  let body = `${marker}\n## Trivy vulnerability scan\n\n`;
  if (!findings) {
    body += "The scanner did not produce a report. See the workflow logs for details.";
  } else {
    body += "| Severity | Package | Installed | Fixed in | Advisory |\n";
    body += "| --- | --- | --- | --- | --- |\n";
    body += findings.slice(0, 50).map((finding) =>
      `| ${escapeCell(finding.Severity)} | \`${escapeCell(finding.PkgName)}\` | \`${escapeCell(finding.InstalledVersion)}\` | \`${escapeCell(finding.FixedVersion)}\` | [${escapeCell(finding.VulnerabilityID)}](${finding.PrimaryURL}) |`,
    ).join("\n");
    if (findings.length > 50) body += `\n\n_Only the first 50 of ${findings.length} findings are shown._`;
  }

  if (existing) {
    await github.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body });
  } else {
    await github.rest.issues.createComment({ owner, repo, issue_number, body });
  }
}
