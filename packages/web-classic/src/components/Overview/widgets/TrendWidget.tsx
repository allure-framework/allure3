import { ChartWidget } from "@allurereport/web-components/ChartWidget";
import { Loadable } from "@allurereport/web-components/core";

import { useI18n } from "@/stores/locale";
import { trendStore } from "@/stores/trend";
import { findTrendChart } from "@/utils/overview";

import * as styles from "../Overview.module.scss";

export const TrendWidget = () => {
  const { t } = useI18n("charts");
  const { t: empty } = useI18n("empty");

  return (
    <Loadable
      source={trendStore}
      renderError={() => null}
      renderData={(charts) => {
        const trend = findTrendChart(charts);

        if (!trend) {
          return null;
        }

        return (
          <div className={styles["overview-widget"]} data-testid="overview-trend">
            <ChartWidget chartData={trend} t={t} empty={empty} />
          </div>
        );
      }}
    />
  );
};
