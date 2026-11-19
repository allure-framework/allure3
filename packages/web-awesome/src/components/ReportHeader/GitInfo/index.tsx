import { getCiGitInfo, getReportOptions } from "@allurereport/web-commons";
import { Text, SvgIcon, allureIcons } from "@allurereport/web-components/core";

import { getCiIconId } from "@/components/Header/CiInfo";
import { useI18n } from "@/stores/locale";

import type { ReportOptions } from "../../../../types";

import * as styles from "./styles.scss";

const SHORT_COMMIT_LENGTH = 7;

const GitValue = ({
  label,
  value,
  text = value,
  icon,
  href,
  testId,
}: {
  label: string;
  value: string;
  text?: string;
  icon: string;
  href?: string;
  testId: string;
}) => {
  const title = `${label}: ${value}`;
  const linkContent = (
    <>
      <SvgIcon className={styles["git-info-icon"]} id={icon} size="xs" aria-hidden="true" />
      <Text className={styles["git-info-value"]} type="ui" size="m">
        {text}
      </Text>
    </>
  );
  const content = href ? (
    <a
      className={styles["git-info-item"]}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      aria-label={title}
      data-testid={testId}
    >
      {linkContent}
    </a>
  ) : (
    <span className={styles["git-info-item"]} title={title} data-testid={testId}>
      {linkContent}
    </span>
  );

  return <li>{content}</li>;
};

export const GitInfo = () => {
  const { t } = useI18n("ui");
  const { ci, git } = getReportOptions<ReportOptions>() ?? {};
  const { ciLabel, ciUrl: safeCiUrl, isPullRequest, branch, branchUrl, commit, commitUrl } = getCiGitInfo(ci, git);
  const ciIconId = isPullRequest
    ? allureIcons.lineDevGitPullRequest
    : (getCiIconId(ci?.type) ?? allureIcons.lineGeneralLink1);

  if (!branch && !commit && !ciLabel) {
    return null;
  }

  return (
    <ul className={styles["git-info"]} data-testid="git-info">
      {branch && (
        <GitValue
          label={t("gitBranch")}
          value={branch}
          icon={allureIcons.lineDevGitBranch}
          href={branchUrl}
          testId="git-info-branch"
        />
      )}
      {commit && (
        <GitValue
          label={t("gitCommit")}
          icon={allureIcons.lineDevGitCommit}
          value={commit}
          text={commit.slice(0, SHORT_COMMIT_LENGTH)}
          href={commitUrl}
          testId="git-info-commit"
        />
      )}
      {ciLabel && (
        <GitValue
          label={t(isPullRequest ? "openPullRequest" : "openJobRun")}
          value={ciLabel}
          icon={ciIconId}
          href={safeCiUrl}
          testId="git-info-ci"
        />
      )}
    </ul>
  );
};
