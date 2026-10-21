import { getReportOptions } from "@allurereport/web-commons";
import { Text } from "@allurereport/web-components/core";
import { useState } from "preact/hooks";
import type { ReportOptions } from "types";

import { currentLocaleIso } from "@/stores/locale";

import * as styles from "./styles.scss";

export const FooterVersion = () => {
  const [reportOptions] = useState(() => getReportOptions<ReportOptions>());
  const createdAt = reportOptions?.createdAt;
  const currentVersion = reportOptions?.allureVersion;
  const formattedCreatedAt =
    typeof createdAt === "number" && Number.isFinite(new Date(createdAt).getTime())
      ? new Date(createdAt).toLocaleDateString(currentLocaleIso.value as string, {
          month: "numeric",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          timeZoneName: "longOffset",
        })
      : undefined;

  return (
    <Text type="paragraph" size="m" className={styles.version}>
      {formattedCreatedAt && <bdi>{formattedCreatedAt}</bdi>}
      {currentVersion && <span> Ver: {currentVersion}</span>}
    </Text>
  );
};
