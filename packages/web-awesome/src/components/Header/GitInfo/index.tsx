import { sanitizeExternalUrl } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { DropdownButton, Menu, MiddleEllipsis, SvgIcon, allureIcons } from "@allurereport/web-components/core";

import { useI18n } from "@/stores/locale";

import type { ReportOptions } from "../../../../types";
import { getCiIconId, getCiLabel } from "../CiInfo";
import { getGitLinks } from "./links";

import * as styles from "./styles.scss";

const SHORT_COMMIT_LENGTH = 7;

const externalLinkIcon = <SvgIcon id={allureIcons.lineGeneralLinkExternal} data-testid="git-info-external-icon" />;

export const GitInfo = () => {
  const { t } = useI18n("ui");
  const { ci, git } = getReportOptions<ReportOptions>() ?? {};
  const branch = ci?.sourceBranch || ci?.jobRunBranch || git?.branch;
  const commit = git?.commit;
  const { branchUrl, commitUrl } = getGitLinks(ci, branch, commit);
  const ciUrl = ci?.pullRequestUrl || ci?.jobRunUrl || ci?.jobUrl;
  const ciLabel = getCiLabel(ci, ciUrl);
  const safeCiUrl = sanitizeExternalUrl(ciUrl);
  const ciIconId = getCiIconId(ci?.type);
  const openCiLabel = ci?.pullRequestUrl ? t("openPullRequest") : t("openJobRun");
  const triggerText = ciLabel || branch || commit?.slice(0, SHORT_COMMIT_LENGTH);

  if (!triggerText) {
    return null;
  }

  return (
    <Menu
      size="xs"
      placement={"bottom-start"}
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton
          style="ghost"
          size="m"
          text={triggerText}
          icon={ciIconId}
          iconSize="xs"
          isExpanded={isOpened}
          isTextTruncated
          onClick={onClick}
          className={styles["git-info-trigger"]}
          data-testid="git-info"
        />
      )}
    >
      <Menu.Section>
        {safeCiUrl && (
          <Menu.Item
            leadingIcon={ciIconId ?? allureIcons.lineGeneralLink1}
            leadingIconFilled={Boolean(ciIconId)}
            href={safeCiUrl}
            rightSlot={externalLinkIcon}
            showRightSlotOnHover
            dataTestId="git-info-ci"
          >
            <span className={styles["git-info-value"]} title={ciLabel}>
              {openCiLabel}
            </span>
          </Menu.Item>
        )}
        {branch && (
          <Menu.Item
            leadingIcon={allureIcons.lineDevDataflow3}
            href={branchUrl}
            copyValue={branch}
            rightSlot={branchUrl ? externalLinkIcon : undefined}
            showRightSlotOnHover
            dataTestId="git-info-branch"
          >
            <span className={styles["git-info-value"]} title={`${t("gitBranch")}: ${branch}`}>
              {branch}
            </span>
          </Menu.Item>
        )}
        {commit && (
          <Menu.Item
            leadingIcon={allureIcons.lineDevCodeSquare}
            href={commitUrl}
            copyValue={commit}
            rightSlot={commitUrl ? externalLinkIcon : undefined}
            showRightSlotOnHover
            dataTestId="git-info-commit"
          >
            <MiddleEllipsis text={commit} />
          </Menu.Item>
        )}
      </Menu.Section>
    </Menu>
  );
};
