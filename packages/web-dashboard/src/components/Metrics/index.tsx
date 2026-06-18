import { Widget } from "@allurereport/web-components";
import { useEffect } from "preact/hooks";

import { useI18n } from "@/stores/locale";
import { fetchMetricsData, metricRows, metricsStore, type MetricRow } from "@/stores/metrics";

import * as styles from "./styles.scss";

const formatValue = (value: number, unit?: string) => {
  const formatted = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));

  return unit ? `${formatted} ${unit}` : formatted;
};

const deltaDirection = ({ delta, better = "neutral" }: { delta: number; better?: MetricRow["better"] }) => {
  if (delta === 0 || better === "neutral") {
    return "neutral";
  }

  if (better === "lower") {
    return delta < 0 ? "good" : "bad";
  }

  return delta > 0 ? "good" : "bad";
};

const formatDelta = ({ delta, unit, better = "neutral" }: MetricRow) => {
  if (typeof delta !== "number" || !Number.isFinite(delta)) {
    return "";
  }

  const sign = delta > 0 ? "+" : "";

  return (
    <span className={styles.delta} data-direction={deltaDirection({ delta, better })}>
      {sign}
      {formatValue(delta, unit)}
    </span>
  );
};

const sparklinePoints = (values: number[]) => {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return "0,16 72,16";
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 72;
      const y = 28 - ((value - min) / range) * 24;

      return `${Number(x.toFixed(2))},${Number(y.toFixed(2))}`;
    })
    .join(" ");
};

const Sparkline = ({ values }: { values: number[] }) => (
  <svg className={styles.sparkline} viewBox="0 0 72 32" aria-hidden="true">
    <polyline points={sparklinePoints(values)} />
  </svg>
);

export const Metrics = () => {
  const { t } = useI18n("charts");

  useEffect(() => {
    fetchMetricsData();
  }, []);

  if (metricsStore.value.loading || metricsStore.value.error || !metricsStore.value.data) {
    return null;
  }

  const rows = metricRows(metricsStore.value.data);
  const featuredRows = rows.slice(0, 6);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={styles.metrics} data-testid="metrics-view">
      <Widget title={t("metrics.title")}>
        <div className={styles.summary}>
          {featuredRows.map((row) => (
            <div className={styles.summaryItem} key={row.key}>
              <div className={styles.summaryMain}>
                <span className={styles.metricName}>{row.name ?? row.key}</span>
                <span className={styles.metricValue}>{formatValue(row.value, row.unit)}</span>
              </div>
              <div className={styles.summaryMeta}>
                {formatDelta(row)}
                <Sparkline values={row.trend} />
              </div>
            </div>
          ))}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("metrics.table.metric")}</th>
                <th>{t("metrics.table.value")}</th>
                <th>{t("metrics.table.delta")}</th>
                <th>{t("metrics.table.source")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <span className={styles.metricName}>{row.name ?? row.key}</span>
                    {row.group && <span className={styles.metricGroup}>{row.group}</span>}
                  </td>
                  <td>{formatValue(row.value, row.unit)}</td>
                  <td>{formatDelta(row)}</td>
                  <td>{row.source ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Widget>
    </div>
  );
};
