import { Loadable } from "@allurereport/web-components";
import { SuccessRatePieChart } from "@allurereport/web-components";

import { pieChartStore } from "@/stores/chart";
import { useI18n } from "@/stores/locale";

import * as styles from "./styles.scss";

export const ReportHeaderPie = () => {
  const { t } = useI18n("charts");
  const { t: status } = useI18n("statuses");

  return (
    <div className={styles["report-header-pie"]}>
      <Loadable
        source={pieChartStore}
        renderLoader={() => null}
        renderData={(chartData) => (
          <SuccessRatePieChart
            {...chartData}
            i18n={(key, values) => (key.startsWith("status.") ? status(key.slice(7)) : t(`successRate.${key}`, values))}
          />
        )}
      />
    </div>
  );
};
