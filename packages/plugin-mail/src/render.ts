import type { TestStatus } from "@allurereport/core-api";
import mjml2html from "mjml";

import type { MailData } from "./model.js";

const statusColors: Record<TestStatus, string> = {
  passed: "#4caf50",
  failed: "#f44336",
  broken: "#ffb300",
  skipped: "#9e9e9e",
  unknown: "#b388ff",
};

const statusOrder: TestStatus[] = ["failed", "broken", "passed", "skipped", "unknown"];

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeUrl = (url?: string): string | undefined => {
  if (!url) {
    return undefined;
  }

  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? escapeHtml(url) : undefined;
  } catch {
    return undefined;
  }
};

const link = (label: string, url?: string): string => {
  const href = safeUrl(url);

  return href ? `<a href="${href}" style="color:#1565c0">${escapeHtml(label)}</a>` : escapeHtml(label);
};

const renderStats = ({ stats }: MailData): string =>
  statusOrder
    .map((status) => {
      const count = stats[status] ?? 0;

      return `<td align="center" style="padding:8px">
  <div style="font-size:24px;font-weight:bold;color:${statusColors[status]}">${count}</div>
  <div style="font-size:12px;color:#616161;text-transform:capitalize">${status}</div>
</td>`;
    })
    .join("");

const renderCi = ({ ci }: MailData): string => {
  if (!ci) {
    return "";
  }

  const rows = [
    ci.name ? `Build: ${link(ci.name, ci.url)}` : undefined,
    ci.branch ? `Branch: ${escapeHtml(ci.branch)}` : undefined,
    ci.pullRequestName ? `Pull request: ${link(ci.pullRequestName, ci.pullRequestUrl)}` : undefined,
  ].filter(Boolean);

  return rows.length ? `<mj-text color="#616161" font-size="13px">${rows.join("<br/>")}</mj-text>` : "";
};

const renderFailed = ({ failed, hiddenFailed }: MailData): string => {
  if (failed.length === 0) {
    return "";
  }

  const items = failed
    .map(
      ({ name, status, message }) =>
        `<li style="margin-bottom:8px"><span style="color:${statusColors[status]};font-weight:bold">${escapeHtml(status)}</span> ${escapeHtml(name)}${
          message ? `<br/><span style="color:#757575;font-size:12px">${escapeHtml(message)}</span>` : ""
        }</li>`,
    )
    .join("");
  const more = hiddenFailed > 0 ? `<p style="color:#757575">… and ${hiddenFailed} more</p>` : "";

  return `<mj-section background-color="#ffffff" padding-top="0">
  <mj-column>
    <mj-text font-size="16px" font-weight="bold">Failed tests</mj-text>
    <mj-text font-size="13px"><ul style="padding-left:20px;margin:0">${items}</ul>${more}</mj-text>
  </mj-column>
</mj-section>`;
};

export const renderMjml = (data: MailData): string => {
  const reportHref = safeUrl(data.reportUrl);

  return `<mjml>
  <mj-head>
    <mj-title>${escapeHtml(data.title)}</mj-title>
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f5f5f5">
    <mj-section background-color="#ffffff" padding-bottom="0">
      <mj-column>
        <mj-text font-size="22px" font-weight="bold">${escapeHtml(data.title)}</mj-text>
        <mj-text color="#616161" font-size="14px">${data.passRate}% passed · ${data.stats.total} tests · ${escapeHtml(data.duration)}</mj-text>
        ${renderCi(data)}
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff">
      <mj-column>
        <mj-raw><table width="100%" role="presentation"><tr>${renderStats(data)}</tr></table></mj-raw>
      </mj-column>
    </mj-section>
    ${
      reportHref
        ? `<mj-section background-color="#ffffff" padding-top="0">
      <mj-column>
        <mj-button href="${reportHref}" background-color="#1565c0">Open report</mj-button>
      </mj-column>
    </mj-section>`
        : ""
    }
    ${renderFailed(data)}
  </mj-body>
</mjml>`;
};

export const renderMail = async (data: MailData): Promise<string> => {
  // mjml 4 is synchronous, mjml 5 returns a promise; awaiting handles both
  const { html } = await mjml2html(renderMjml(data), { validationLevel: "soft" });

  return html;
};
