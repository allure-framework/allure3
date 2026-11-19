import type { ReportOptions } from "@allurereport/plugin-api";
import { getCiGitInfo } from "@allurereport/web-commons";
import { MiddleEllipsis, SvgIcon, Text, allureIcons, getCiIconId } from "@allurereport/web-components/core";
import type { ComponentChildren } from "preact";

import { useI18n } from "@/stores/locale";

import * as styles from "../Overview.module.scss";

const InfoItem = ({
  icon,
  title,
  href,
  children,
  testId,
}: {
  icon: string;
  title: string;
  href?: string;
  children: ComponentChildren;
  testId: string;
}) => (
  <li className={styles["overview-ci-item"]} title={title} data-testid={testId}>
    <SvgIcon id={icon} size="s" />
    {href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles["overview-ci-value"]}>
        {children}
      </a>
    ) : (
      <span className={styles["overview-ci-value"]}>{children}</span>
    )}
  </li>
);

export const CiInfo = ({ reportOptions }: { reportOptions?: Pick<ReportOptions, "ci" | "git"> }) => {
  const { t } = useI18n("overview");
  const { ciLabel, ciUrl, isPullRequest, branch, branchUrl, commit, commitUrl } = getCiGitInfo(
    reportOptions?.ci,
    reportOptions?.git,
  );
  const ciIconId = getCiIconId(reportOptions?.ci?.type);

  if (!ciLabel && !branch && !commit) {
    return null;
  }

  return (
    <ul className={styles["overview-ci"]} data-testid="overview-ci-info">
      {ciLabel && (
        <InfoItem
          icon={ciIconId ?? allureIcons.lineGeneralLink1}
          title={isPullRequest ? t("pullRequest") : t("ciBuild")}
          href={ciUrl}
          testId="overview-ci-build"
        >
          <Text type="ui" size="s">
            {ciLabel}
          </Text>
        </InfoItem>
      )}
      {branch && (
        <InfoItem
          icon={allureIcons.lineDevDataflow3}
          title={`${t("branch")}: ${branch}`}
          href={branchUrl}
          testId="overview-ci-branch"
        >
          <Text type="ui" size="s">
            {branch}
          </Text>
        </InfoItem>
      )}
      {commit && (
        <InfoItem
          icon={allureIcons.lineDevCodeSquare}
          title={`${t("commit")}: ${commit}`}
          href={commitUrl}
          testId="overview-ci-commit"
        >
          <Text type="ui" size="s">
            <MiddleEllipsis text={commit} />
          </Text>
        </InfoItem>
      )}
    </ul>
  );
};
