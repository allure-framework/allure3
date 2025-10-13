import { CiDescriptor, CiType } from "@allurereport/core-api";
import { getReportOptions } from "@allurereport/web-commons";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { ClassValue } from "clsx";
import clsx from "clsx";
import type { AwesomeReportOptions } from "../../../../types";
import * as styles from "./styles.scss";

interface CiInfoProps {
  className?: ClassValue;
}

interface CiIconProps {
  type: CiDescriptor["type"];
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
  const { ci } = getReportOptions<AwesomeReportOptions>();

  if (!ci) {
    return null;
  }

  const link = ci.pullRequestUrl || ci.jobRunUrl || ci.jobUrl;
  const label = ci.pullRequestName || ci.jobRunName || ci.jobName || link;

  if (!link) {
    return null;
  }

  return (
    <a className={clsx(styles["ci-info"], className)} href={link} target="_blank">
      <CiIcon type={ci.type} />
      <Text type={"paragraph"} size={"m"} bold>
        {label}
      </Text>
    </a>
  );
};
