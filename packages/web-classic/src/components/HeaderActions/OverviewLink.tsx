import { getReportOptions } from "@allurereport/web-commons";
import { OverviewLink as OverviewLinkButton } from "@allurereport/web-components";

import { useI18n } from "@/stores/locale";

import type { ReportOptions } from "../../../types";

import * as styles from "./styles.scss";

export const OverviewLink = () => {
  const { t } = useI18n("controls");
  const { overviewHref } = getReportOptions<ReportOptions>() ?? {};

  if (!overviewHref) {
    return null;
  }

  return (
    <div className={styles["header-overview"]}>
      <OverviewLinkButton href={overviewHref} text={t("backToOverview")} />
    </div>
  );
};
