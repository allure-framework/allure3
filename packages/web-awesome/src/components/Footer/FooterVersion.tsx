import { getReportOptions } from "@allurereport/web-commons";
import { Text } from "@allurereport/web-components/core";
import { useState } from "preact/hooks";
import type { ReportOptions } from "types";

import { useI18n } from "@/stores";
import { defaultDateTimeOptions, timestampToDate } from "@/utils/time";

import * as styles from "./styles.scss";

export const FooterVersion = () => {
  const { t } = useI18n("ui");
  const [createdAt] = useState(() => getReportOptions<ReportOptions>()?.createdAt);

  const [currentVersion] = useState<string>(() => {
    const reportOptions = getReportOptions<ReportOptions>();

    if (reportOptions?.allureVersion) {
      return reportOptions.allureVersion as string;
    }

    return undefined;
  });

  const formattedCreatedAt =
    typeof createdAt === "number" && Number.isFinite(new Date(createdAt).getTime())
      ? timestampToDate(createdAt, { ...defaultDateTimeOptions, timeZoneName: "longOffset" })
      : undefined;

  return (
    <Text type="paragraph" size="m" className={styles.version}>
      {formattedCreatedAt && (
        <span>
          {t("generated")} <bdi>{formattedCreatedAt}</bdi>
        </span>
      )}
      {currentVersion && <span> Ver: {currentVersion}</span>}
    </Text>
  );
};
