import { CiDescriptor, CiType, sanitizeExternalUrl } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components/core";
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

const ciIconIds: Partial<Record<CiType, string>> = {
  [CiType.Amazon]: allureIcons.amazon,
  [CiType.Azure]: allureIcons.azure,
  [CiType.Bitbucket]: allureIcons.bitbucket,
  [CiType.Circle]: allureIcons.circleci,
  [CiType.Drone]: allureIcons.drone,
  [CiType.Github]: allureIcons.github,
  [CiType.Gitlab]: allureIcons.gitlab,
  [CiType.Jenkins]: allureIcons.jenkins,
};

export const getCiIconId = (type?: CiDescriptor["type"]) => (type ? ciIconIds[type] : undefined);

export const CiIcon = ({ type }: CiIconProps) => {
  const id = getCiIconId(type);

  return id ? <SvgIcon id={id} width={16} height={16} /> : null;
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

  return (
    <a className={clsx(styles["ci-info"], className)} href={safeLink} target="_blank" rel="noopener noreferrer">
      <CiIcon type={ci?.type} />
      <Text type="paragraph" size="m" bold>
        {ciLabel}
      </Text>
    </a>
  );
};

export const getCiLabel = (ci?: CiDescriptor, link?: string) => {
  if (!ci) {
    return undefined;
  }

  return ci.pullRequestName || ci.jobRunName || ci.jobName || link;
};
