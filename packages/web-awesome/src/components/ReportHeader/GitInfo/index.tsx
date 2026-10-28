import { sanitizeExternalUrl } from "@allurereport/core-api";
import { copyToClipboard, getReportOptions } from "@allurereport/web-commons";
import { IconButton, SvgIcon, TooltipWrapper, allureIcons } from "@allurereport/web-components/core";
import { useState } from "preact/hooks";

import { getCiIconId, getCiLabel } from "@/components/Header/CiInfo";
import { useI18n } from "@/stores/locale";

import type { ReportOptions } from "../../../../types";
import { getGitLinks } from "./links";

import * as styles from "./styles.scss";

const SHORT_COMMIT_LENGTH = 7;

// the local CI descriptor has HEAD instead of the branch in the detached head, it is not a branch
const isKnownBranch = (name?: string): name is string => Boolean(name) && name !== "HEAD";

const GitValue = ({
  label,
  value,
  text = value,
  href,
  testId,
}: {
  label: string;
  value: string;
  text?: string;
  href?: string;
  testId: string;
}) => {
  const { t } = useI18n("controls");
  const [copyStatus, setCopyStatus] = useState<string>();
  const copyLabel = `${t("clipboard")}: ${label}`;
  const copy = async () => {
    setCopyStatus((await copyToClipboard(value)) ? t("clipboardSuccess") : t("clipboardError"));
  };
  const content = (
    <>
      {label}: {text}
    </>
  );

  return (
    <span
      className={styles["git-info-item"]}
      onMouseLeave={() => setCopyStatus(undefined)}
      onBlur={() => setCopyStatus(undefined)}
    >
      {href ? (
        <>
          <a
            className={styles["git-info-value"]}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={value}
            data-testid={testId}
          >
            {content}
          </a>
          <TooltipWrapper tooltipText={copyStatus ?? copyLabel}>
            <IconButton
              style="ghost"
              size="s"
              icon={allureIcons.lineGeneralCopy3}
              aria-label={copyLabel}
              onClick={copy}
            />
          </TooltipWrapper>
        </>
      ) : (
        <TooltipWrapper tooltipText={copyStatus ?? copyLabel}>
          <button
            type="button"
            className={styles["git-info-value"]}
            title={value}
            aria-label={`${copyLabel}: ${value}`}
            onClick={copy}
            data-testid={testId}
          >
            {content}
          </button>
        </TooltipWrapper>
      )}
    </span>
  );
};

export const GitInfo = () => {
  const { t } = useI18n("ui");
  const { ci, git } = getReportOptions<ReportOptions>() ?? {};
  const branch = [ci?.sourceBranch, ci?.jobRunBranch, git?.branch].find(isKnownBranch);
  const commit = git?.commit;
  const { branchUrl, commitUrl } = getGitLinks(ci, branch, commit);
  const ciUrl = ci?.pullRequestUrl || ci?.jobRunUrl || ci?.jobUrl;
  const ciLabel = getCiLabel(ci, ciUrl);
  const safeCiUrl = sanitizeExternalUrl(ciUrl);
  const ciIconId = getCiIconId(ci?.type) ?? allureIcons.lineGeneralLink1;

  if (!branch && !commit && !ciLabel) {
    return null;
  }

  return (
    <div className={styles["git-info"]} data-testid="git-info">
      {branch && <GitValue label={t("gitBranch")} value={branch} href={branchUrl} testId="git-info-branch" />}
      {commit && (
        <GitValue
          label={t("gitCommit")}
          value={commit}
          text={commit.slice(0, SHORT_COMMIT_LENGTH)}
          href={commitUrl}
          testId="git-info-commit"
        />
      )}
      {ciLabel && (
        <span className={styles["git-info-item"]}>
          <SvgIcon id={ciIconId} size="s" />
          {safeCiUrl ? (
            <a
              className={styles["git-info-value"]}
              href={safeCiUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="git-info-ci"
            >
              {ciLabel}
            </a>
          ) : (
            <span className={styles["git-info-value"]} data-testid="git-info-ci">
              {ciLabel}
            </span>
          )}
        </span>
      )}
    </div>
  );
};
