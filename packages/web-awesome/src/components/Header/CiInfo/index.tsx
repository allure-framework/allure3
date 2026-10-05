import { CiDescriptor, CiType, sanitizeExternalUrl } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { ClassValue } from "clsx";
import clsx from "clsx";

import type { ReportOptions } from "../../../../types";

import * as styles from "./styles.scss";

interface CiInfoProps {
  className?: ClassValue;
}

interface CiIconProps {
  type?: CiDescriptor["type"];
}

export const CiIcon = ({ type }: CiIconProps) => {
  const iconCommonProps = {
    width: 16,
    height: 16,
  };

  switch (type) {
    case CiType.Amazon:
      return <SvgIcon id={allureIcons.amazon} {...iconCommonProps} />;
    case CiType.Azure:
      return <SvgIcon id={allureIcons.azure} {...iconCommonProps} />;
    case CiType.Bitbucket:
      return <SvgIcon id={allureIcons.bitbucket} {...iconCommonProps} />;
    case CiType.Circle:
      return <SvgIcon id={allureIcons.circleci} {...iconCommonProps} />;
    case CiType.Drone:
      return <SvgIcon id={allureIcons.drone} {...iconCommonProps} />;
    case CiType.Github:
      return <SvgIcon id={allureIcons.github} {...iconCommonProps} />;
    case CiType.Gitlab:
      return <SvgIcon id={allureIcons.gitlab} {...iconCommonProps} />;
    case CiType.Jenkins:
      return <SvgIcon id={allureIcons.jenkins} {...iconCommonProps} />;
    default:
      return null;
  }
};

export const CiInfo = ({ className }: CiInfoProps) => {
  const { ci } = getReportOptions<ReportOptions>();

  const ciLink = ci ? ci.pullRequestUrl || ci.jobRunUrl || ci.jobUrl : undefined;
  const ciLabel = getCiLabel(ci, ciLink);
  const safeLink = sanitizeExternalUrl(ciLink);

  if (!ciLabel) {
    return null;
  }

  if (!safeLink) {
    return (
      <span className={clsx(styles["ci-info"], className)}>
        <CiIcon type={ci?.type} />
        <Text type="paragraph" size="m" bold>
          {ciLabel}
        </Text>
      </span>
    );
  }

  // Some host pages embed the report inside a sandboxed iframe and attach their own
  // click handling to anchors (e.g. the Azure DevOps Marketplace "Publish Allure Report"
  // extension tab). When that happens, the host can resolve this absolute, external
  // `safeLink` relative to its own origin instead of navigating to it directly, which
  // breaks links such as Azure DevOps pull request URLs. Opening the link explicitly via
  // `window.open` on primary, unmodified clicks bypasses any such anchor-click
  // interception while still leaving the native `href`/`target`/`rel` in place so
  // modified clicks (new tab/window, copy link, etc.) keep working as expected.
  const handleClick = (event: MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    window.open(safeLink, "_blank", "noopener,noreferrer");
  };

  return (
    <a
      className={clsx(styles["ci-info"], className)}
      href={safeLink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
    >
      <CiIcon type={ci?.type} />
      <Text type="paragraph" size="m" bold>
        {ciLabel}
      </Text>
    </a>
  );
};

const getCiLabel = (ci?: CiDescriptor, link?: string) => {
  if (!ci) {
    return undefined;
  }

  return ci.pullRequestName || ci.jobRunName || ci.jobName || link;
};
