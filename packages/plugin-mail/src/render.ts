import { type TestStatus, capitalize, sanitizeExternalUrl } from "@allurereport/core-api";
import mjml2html from "mjml";

import type { MailData } from "./model.js";

/**
 * Values of the Allure report light theme (web-components semantic tokens), flattened to hex for mail clients.
 * Status fill and on-fill colors are the ones of the status label and the report statistics.
 */
const theme = {
  canvas: "#f1f5f7",
  surface: "#ffffff",
  border: "#edf1f5",
  textPrimary: "#2c333f",
  textSecondary: "#535e6d",
  textMuted: "#677180",
  link: "#2f5fc5",
  primary: "#7855d0",
  onPrimary: "#fbfdfe",
  radiusCard: "8px",
  radiusControl: "6px",
  // PT Root UI, the font of the report, is a web font which most mail clients ignore
  fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  dark: {
    canvas: "#2c343f",
    surface: "#1b2129",
    border: "#272e39",
    textPrimary: "#edf1f5",
    textSecondary: "#c5ccd5",
    textMuted: "#97a2af",
    link: "#b2ccff",
  },
  fontFamilyMono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const statusFills: Record<TestStatus, string> = {
  passed: "#3bc95d",
  failed: "#f43f3b",
  broken: "#ffd833",
  skipped: "#a5b7d1",
  unknown: "#a181ff",
};

const statusOnFills: Record<TestStatus, string> = {
  passed: "#0d121c",
  failed: "#ffffff",
  broken: "#0d121c",
  skipped: "#0d121c",
  unknown: "#ffffff",
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
  const sanitized = sanitizeExternalUrl(url);

  return sanitized ? escapeHtml(sanitized) : undefined;
};

const link = (label: string, url?: string): string => {
  const href = safeUrl(url);

  return href
    ? `<a class="m-link" href="${href}" style="color:${theme.link};text-decoration:none">${escapeHtml(label)}</a>`
    : escapeHtml(label);
};

const dot = (status: TestStatus): string =>
  `<span style="color:${statusFills[status]};font-size:14px;line-height:14px">&#9679;</span>`;

/** The status pill of the report summary card */
const renderStatusLabel = (status: TestStatus): string =>
  `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background-color:${statusFills[status]};color:${statusOnFills[status]};font-size:12px;line-height:16px;font-weight:600">${capitalize(status) ?? status}</span>`;

/** Like the report statistics: the total first, then only the statuses that have tests */
const renderStatistics = ({ stats }: MailData): string => {
  const items = [
    `<td style="padding:0 16px 8px 0;font-size:14px;line-height:20px;white-space:nowrap"><span class="m-t2" style="color:${theme.textSecondary}">Total</span> <strong class="m-t1" style="color:${theme.textPrimary}">${stats.total}</strong></td>`,
    ...statusOrder
      .filter((status) => (stats[status] ?? 0) > 0)
      .map(
        (status) =>
          `<td style="padding:0 16px 8px 0;font-size:14px;line-height:20px;white-space:nowrap">${dot(status)} <span class="m-t2" style="color:${theme.textSecondary}">${capitalize(status) ?? status}</span> <strong class="m-t1" style="color:${theme.textPrimary}">${stats[status]}</strong></td>`,
      ),
  ];

  return `<table role="presentation" style="border-collapse:collapse"><tr>${items.join("")}</tr></table>`;
};

const renderCi = ({ ci }: MailData): string => {
  if (!ci) {
    return "";
  }

  const rows = [
    ci.name ? `Build: ${link(ci.name, ci.url)}` : undefined,
    ci.branch ? `Branch: ${escapeHtml(ci.branch)}` : undefined,
    ci.pullRequestName ? `Pull request: ${link(ci.pullRequestName, ci.pullRequestUrl)}` : undefined,
  ].filter(Boolean);

  return rows.length
    ? `<mj-text css-class="m-t2" color="${theme.textSecondary}" padding-top="8px">${rows.join("<br/>")}</mj-text>`
    : "";
};

const renderFailed = ({ failed, hiddenFailed }: MailData): string => {
  if (failed.length === 0) {
    return "";
  }

  const rows = failed
    .map(
      ({ name, status, message }) =>
        `<tr><td valign="top" style="padding:0 8px 12px 0;width:14px">${dot(status)}</td><td class="m-t1" style="padding:0 0 12px 0;font-size:14px;line-height:20px;color:${theme.textPrimary}">${escapeHtml(name)}${
          message
            ? `<div class="m-t3" style="font-family:${theme.fontFamilyMono};font-size:12px;line-height:16px;color:${theme.textMuted}">${escapeHtml(message)}</div>`
            : ""
        }</td></tr>`,
    )
    .join("");
  const more =
    hiddenFailed > 0
      ? `<div class="m-t3" style="font-size:14px;line-height:20px;color:${theme.textMuted}">… and ${hiddenFailed} more</div>`
      : "";

  return `<mj-text font-size="18px" line-height="24px" font-weight="700" padding-top="24px" padding-bottom="12px">Failed tests</mj-text>
        <mj-text><table role="presentation" width="100%" style="border-collapse:collapse">${rows}</table>${more}</mj-text>`;
};

/** The preheader: the first text a mail client shows in the inbox list, next to the subject */
const renderPreview = ({ stats }: MailData): string => {
  const parts = statusOrder.filter((status) => (stats[status] ?? 0) > 0).map((status) => `${stats[status]} ${status}`);

  return stats.total > 0 ? `${parts.join(", ")} of ${stats.total} tests` : "No test results";
};

const darkModeStyles = `@media (prefers-color-scheme: dark) {
  body, .m-canvas { background-color: ${theme.dark.canvas} !important; }
  .m-card > table > tbody > tr > td { background-color: ${theme.dark.surface} !important; border-color: ${theme.dark.border} !important; }
  .m-t1, .m-t1 div { color: ${theme.dark.textPrimary} !important; }
  .m-t2, .m-t2 div { color: ${theme.dark.textSecondary} !important; }
  .m-t3, .m-t3 div { color: ${theme.dark.textMuted} !important; }
  .m-link { color: ${theme.dark.link} !important; }
}`;

export const renderMjml = (data: MailData): string => {
  const reportHref = safeUrl(data.reportUrl);

  return `<mjml>
  <mj-head>
    <mj-title>${escapeHtml(data.title)}</mj-title>
    <mj-preview>${escapeHtml(renderPreview(data))}</mj-preview>
    <mj-raw><meta name="color-scheme" content="light dark" /><meta name="supported-color-schemes" content="light dark" /></mj-raw>
    <mj-style>${darkModeStyles}</mj-style>
    <mj-attributes>
      <mj-all font-family="${theme.fontFamily}" padding="0" />
      <mj-text css-class="m-t1" color="${theme.textPrimary}" font-size="14px" line-height="20px" />
    </mj-attributes>
  </mj-head>
  <mj-body css-class="m-canvas" background-color="${theme.canvas}" width="640px">
    <mj-section padding="24px 12px">
      <mj-column css-class="m-card" background-color="${theme.surface}" border="1px solid ${theme.border}" border-radius="${theme.radiusCard}" padding="24px">
        <mj-text font-size="24px" line-height="32px" font-weight="700">${escapeHtml(data.title)}</mj-text>
        <mj-text padding-top="8px">${renderStatusLabel(data.status)} <span class="m-t2" style="color:${theme.textSecondary}">&nbsp;${data.passRate}% passed · ${escapeHtml(data.duration)}</span></mj-text>
        ${renderCi(data)}
        <mj-text padding-top="16px">${renderStatistics(data)}</mj-text>
        ${
          reportHref
            ? `<mj-button href="${reportHref}" align="left" padding-top="8px" background-color="${theme.primary}" color="${theme.onPrimary}" border-radius="${theme.radiusControl}" inner-padding="10px 16px" font-size="14px" font-weight="600">Open report</mj-button>`
            : ""
        }
        ${renderFailed(data)}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
};

export const renderMail = async (data: MailData): Promise<string> => {
  // mjml 4 is synchronous, mjml 5 returns a promise; awaiting handles both
  const { html } = await mjml2html(renderMjml(data), { validationLevel: "soft" });

  return html;
};
