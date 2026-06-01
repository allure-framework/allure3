import { getReportOptions } from "@allurereport/web-commons";
import { Text } from "@allurereport/web-components";
import { useState } from "preact/hooks";
import type { AwesomeReportOptions } from "types";

import { useI18n } from "@/stores";
import { timestampToDate } from "@/utils/time";

import * as styles from "./styles.scss";

export const FooterVersion = () => {
  const { t } = useI18n("ui");
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

  const formattedCreatedAt = timestampToDate(createdAt as number);

  return (
    <Text type="paragraph" size="m" className={styles.version}>
      {t("generated")} {formattedCreatedAt}
      {currentVersion && <span> Ver: {currentVersion}</span>}
    </Text>
  );
};
