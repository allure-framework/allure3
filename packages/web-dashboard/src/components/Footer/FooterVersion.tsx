import { getReportOptions } from "@allurereport/web-commons";
import { Text } from "@allurereport/web-components/core";
import { useState } from "preact/hooks";
import type { ReportOptions } from "types";

import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

export const FooterVersion = () => {
  const { t } = useI18n("ui");
  const [reportOptions] = useState(() => getReportOptions<ReportOptions>());
  const createdAt = reportOptions?.createdAt;
  const currentVersion = reportOptions?.allureVersion;
  const formattedCreatedAt =
    typeof createdAt === "number" && Number.isFinite(new Date(createdAt).getTime())
      ? t("generatedAt", { timestamp: createdAt, timeZoneName: "longOffset" })
      : undefined;

  return (
    <Text type="paragraph" size="m" className={styles.version}>
      {formattedCreatedAt && <bdi>{formattedCreatedAt}</bdi>}
      {currentVersion && <span> Ver: {currentVersion}</span>}
    </Text>
  );
};
