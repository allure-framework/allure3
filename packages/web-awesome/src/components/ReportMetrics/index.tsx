import { Loadable, PageLoader } from "@allurereport/web-components";
import { useState } from "preact/hooks";

import { useI18n } from "@/stores";
import {
  defaultMetricKey,
  metricHistoryRows,
  metricPhaseRows,
  metricRows,
  type MetricPhaseRow,
  metricsStore,
  type MetricRow,
  type MetricsWidgetData,
} from "@/stores/metrics";

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

const formatDelta = ({ delta, unit, better = "neutral" }: Pick<MetricRow, "delta" | "unit" | "better">) => {
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

const groupedPhaseRows = (rows: MetricPhaseRow[]) => {
  const groups = new Map<string, MetricPhaseRow[]>();

  rows.forEach((row) => {
    const category = row.group ?? "other";

    groups.set(category, [...(groups.get(category) ?? []), row]);
  });

  return [...groups.entries()];
};

const formatGroupLabel = (group: string) =>
  group
    .replaceAll(".", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());

const phaseMetricKey = (phase: string, field: "totalMs" | "avgMs" | "minMs" | "maxMs") => `${phase}.${field}`;

const selectFallbackMetricKey = (row: MetricPhaseRow) => {
  if (typeof row.avgMs === "number") {
    return phaseMetricKey(row.key, "avgMs");
  }

  if (typeof row.totalMs === "number") {
    return phaseMetricKey(row.key, "totalMs");
  }

  return row.key;
};

const MetricHistoryDetails = ({
  selectedRow,
  historyRows,
}: {
  selectedRow: MetricRow;
  historyRows: ReturnType<typeof metricHistoryRows>;
}) => {
  const { t } = useI18n("charts");

  return (
    <section className={styles.section} aria-labelledby="metrics-history">
      <div className={styles.detailsHeader}>
        <h2 className={styles.sectionTitle} id="metrics-history">
          {t("metrics.historyTitle")}
        </h2>
        <span className={styles.detailsMetric}>{selectedRow.name ?? selectedRow.key}</span>
      </div>
      <div className={styles.detailsValue}>
        <span className={styles.metricValue}>{formatValue(selectedRow.value, selectedRow.unit)}</span>
        {formatDelta(selectedRow)}
      </div>
      <Sparkline values={selectedRow.trend} />
      {historyRows.length === 0 ? (
        <div className={styles.emptyInline}>{t("metrics.noHistory")}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.historyTable}`}>
            <thead>
              <tr>
                <th>{t("metrics.table.report")}</th>
                <th>{t("metrics.table.date")}</th>
                <th>{t("metrics.table.value")}</th>
                <th>{t("metrics.table.delta")}</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((row) => (
                <tr key={row.uuid}>
                  <td>
                    {row.url ? (
                      <a href={row.url} target="_blank" rel="noreferrer">
                        {row.name}
                      </a>
                    ) : (
                      row.name
                    )}
                  </td>
                  <td>{t("metrics.date", { timestamp: row.timestamp })}</td>
                  <td>{formatValue(row.value, selectedRow.unit)}</td>
                  <td>{formatDelta({ delta: row.delta, unit: selectedRow.unit, better: selectedRow.better })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

const ReportMetricsContent = ({ data }: { data: MetricsWidgetData }) => {
  const { t } = useI18n("charts");
  const { t: tEmpty } = useI18n("empty");
  const rows = metricRows(data);
  const phaseRows = metricPhaseRows(data);
  const phaseGroups = groupedPhaseRows(phaseRows);
  const [selectedKey, setSelectedKey] = useState<string | undefined>();
  const selectedRow =
    rows.find(({ key }) => key === selectedKey) ?? rows.find(({ key }) => key === defaultMetricKey(data)) ?? rows[0];
  const historyRows = selectedRow ? metricHistoryRows(data, selectedRow.key) : [];

  if (rows.length === 0) {
    return <div className={styles.empty}>{tEmpty("no-metrics-results")}</div>;
  }

  return (
    <div className={styles.metrics} data-testid="metrics-view">
      <header className={styles.header}>
        <h1 className={styles.title}>{t("metrics.title")}</h1>
        <span className={styles.meta}>{t("metrics.summary", { groups: phaseRows.length, metrics: rows.length })}</span>
      </header>

      {phaseRows.length > 0 && (
        <div className={styles.phaseLayout}>
          <section className={styles.section} aria-labelledby="metrics-phase-summary">
            <h2 className={styles.sectionTitle} id="metrics-phase-summary">
              {t("metrics.phaseSummary")}
            </h2>
            {phaseGroups.map(([category, categoryRows]) => (
              <div className={styles.phaseGroup} key={category}>
                <h3 className={styles.groupTitle}>
                  {category === "other" ? t("metrics.groups.other") : formatGroupLabel(category)}
                </h3>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{t("metrics.table.phase")}</th>
                        <th>{t("metrics.table.count")}</th>
                        <th>{t("metrics.table.total")}</th>
                        <th>{t("metrics.table.avg")}</th>
                        <th>{t("metrics.table.min")}</th>
                        <th>{t("metrics.table.max")}</th>
                        <th>{t("metrics.table.delta")}</th>
                        <th>{t("metrics.table.trend")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryRows.map((row) => (
                        <tr key={row.key} data-selected={selectedRow?.key.startsWith(`${row.key}.`)}>
                          <td>
                            <button
                              className={styles.metricButton}
                              type="button"
                              onClick={() => setSelectedKey(selectFallbackMetricKey(row))}
                              aria-label={row.key}
                            >
                              <span className={styles.metricName}>{row.key}</span>
                            </button>
                          </td>
                          <td>{typeof row.count === "number" ? formatValue(row.count) : ""}</td>
                          {(["totalMs", "avgMs", "minMs", "maxMs"] as const).map((field) => (
                            <td key={field}>
                              {typeof row[field] === "number" ? (
                                <button
                                  className={styles.valueButton}
                                  type="button"
                                  onClick={() => setSelectedKey(phaseMetricKey(row.key, field))}
                                  aria-pressed={selectedRow?.key === phaseMetricKey(row.key, field)}
                                  aria-label={`${row.key} ${t(`metrics.table.${field.replace("Ms", "")}`)}`}
                                >
                                  {formatValue(row[field], "ms")}
                                </button>
                              ) : (
                                ""
                              )}
                            </td>
                          ))}
                          <td>{formatDelta({ delta: row.delta, unit: "ms", better: "lower" })}</td>
                          <td>
                            <Sparkline values={row.trend} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          <div className={styles.detailsPanel}>
            {selectedRow && <MetricHistoryDetails selectedRow={selectedRow} historyRows={historyRows} />}
          </div>
        </div>
      )}

      <details className={styles.section} open={phaseRows.length === 0}>
        <summary className={styles.sectionTitle}>{t("metrics.currentValues")}</summary>
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
                <tr key={row.key} data-selected={selectedRow?.key === row.key}>
                  <td>
                    <button className={styles.metricButton} type="button" onClick={() => setSelectedKey(row.key)}>
                      <span className={styles.metricName}>{row.name ?? row.key}</span>
                      {row.group && <span className={styles.metricGroup}>{row.group}</span>}
                    </button>
                  </td>
                  <td>{formatValue(row.value, row.unit)}</td>
                  <td>{formatDelta(row)}</td>
                  <td>{row.source ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {phaseRows.length === 0 && selectedRow && (
        <div className={styles.detailsPanel}>
          <MetricHistoryDetails selectedRow={selectedRow} historyRows={historyRows} />
        </div>
      )}
    </div>
  );
};

export const ReportMetrics = () => {
  return (
    <Loadable
      source={metricsStore}
      renderLoader={() => (
        <div className={styles.loader}>
          <PageLoader />
        </div>
      )}
      renderData={(data) => (data ? <ReportMetricsContent data={data} /> : null)}
    />
  );
};
