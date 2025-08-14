import { CiDescriptor, CiType } from "@allurereport/core-api";
import { SvgIcon, Text, allureIcons } from "@allurereport/web-components";
import type { ClassValue } from "clsx";
import clsx from "clsx";
import { useMemo } from "preact/hooks";
import * as styles from "./styles.scss";

interface CiInfoProps {
  ci: CiDescriptor;
  className?: ClassValue;
}

export const CiInfo = ({ ci, className }: CiInfoProps) => {
  const icon = useMemo(() => {
    switch (ci.type) {
      case CiType.Amazon:
        return allureIcons.amazon;
      case CiType.Azure:
        return allureIcons.azure;
      case CiType.Bitbucket:
        return allureIcons.bitbucket;
      case CiType.Circle:
        return allureIcons.circleci;
      case CiType.Drone:
        return allureIcons.drone;
      case CiType.Github:
        return allureIcons.github;
      case CiType.Gitlab:
        return allureIcons.gitlab;
      case CiType.Jenkins:
        return allureIcons.jenkins;
      default:
        return undefined;
    }
  }, [ci]);
  const link = ci.pullRequestUrl ?? ci.jobUrl ?? ci.jobRunUrl;
  const label = ci.pullRequestName ?? ci.jobName ?? ci.jobRunName ?? link;

  if (!link) {
    return null;
  }

  return (
    <a className={clsx(styles["ci-info"], className)} href={link}>
      {icon && <SvgIcon id={icon} width={16} height={16} />}
      <Text type={"paragraph"} size={"m"} bold>
        {label}
      </Text>
    </a>
  );
};
