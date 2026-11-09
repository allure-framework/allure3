import { CiDescriptor, sanitizeExternalUrl } from "@allurereport/core-api";
import { getCiLabel, getCiLink, getReportOptions } from "@allurereport/web-commons";
import { SvgIcon, Text, getCiIconId } from "@allurereport/web-components/core";
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

export { getCiIconId, getCiLabel };

export const CiIcon = ({ type }: CiIconProps) => {
  const id = getCiIconId(type);

  return id ? <SvgIcon id={id} width={16} height={16} /> : null;
};

export const CiInfo = ({ className }: CiInfoProps) => {
  const { ci } = getReportOptions<ReportOptions>();

  const ciLink = getCiLink(ci);
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
