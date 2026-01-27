import { getReportOptions } from "@allurereport/web-commons";
import { Text } from "@allurereport/web-components";
import { useState } from "preact/hooks";
import type { AwesomeReportOptions } from "types";
import { currentLocaleIso } from "@/stores";
import * as styles from "./styles.scss";

export const FooterVersion = () => {
  const [createdAt] = useState(() => {
    const reportOptions = getReportOptions<AwesomeReportOptions>();
    if (reportOptions?.createdAt) {
      return Number(reportOptions.createdAt);
    }

    return undefined;
  });

  const [currentVersion] = useState<string>(() => {
    const reportOptions = getReportOptions<AwesomeReportOptions>();

    if (reportOptions?.allureVersion) {
      return reportOptions.allureVersion as string;
    }

    return undefined;
  });

  const formattedCreatedAt = new Date(createdAt as number).toLocaleDateString(currentLocaleIso.value as string, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });

  return (
    <Text type="paragraph" size="m" className={styles.version}>
      {formattedCreatedAt}
      {currentVersion && <span> Ver: {currentVersion}</span>}
    </Text>
  );
};
