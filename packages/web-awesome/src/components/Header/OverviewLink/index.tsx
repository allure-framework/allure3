import { getReportOptions } from "@allurereport/web-commons";
import { OverviewLink as OverviewLinkButton } from "@allurereport/web-components/core";

import { useI18n } from "@/stores/locale";

import type { ReportOptions } from "../../../../types";

export const OverviewLink = () => {
  const { t } = useI18n("controls");
  const { overviewHref } = getReportOptions<ReportOptions>() ?? {};

  if (!overviewHref) {
    return null;
  }

  return <OverviewLinkButton href={overviewHref} text={t("backToOverview")} />;
};
