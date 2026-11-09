import { getReportOptions } from "@allurereport/web-commons";
import { Text } from "@allurereport/web-components";
import { h } from "preact";

import { useI18n } from "@/stores";
import { timestampToDate } from "@/utils/time";

import type { ReportOptions } from "../../../types";

import * as styles from "./styles.scss";

const createdAtFormatOptions: Intl.DateTimeFormatOptions = {
  month: "numeric",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
  timeZoneName: "longOffset",
};

const isValidTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(new Date(value).getTime());

export const SideNavReportInfo = () => {
  const { t } = useI18n("ui");
  const { createdAt, allureVersion } = getReportOptions<ReportOptions>() ?? {};
  const formattedCreatedAt = isValidTimestamp(createdAt)
    ? timestampToDate(createdAt, createdAtFormatOptions)
    : undefined;

  if (!formattedCreatedAt && !allureVersion) {
    return null;
  }

  return (
    <div className={styles["report-info"]} data-testid="report-info">
      {formattedCreatedAt && (
        <Text type="paragraph" size="s" className={styles["report-info-line"]} data-testid="report-created-at">
          {t("generated")} <bdi>{formattedCreatedAt}</bdi>
        </Text>
      )}
      {allureVersion && (
        <Text type="paragraph" size="s" className={styles["report-info-line"]} data-testid="report-version">
          Allure {allureVersion}
        </Text>
      )}
    </div>
  );
};
