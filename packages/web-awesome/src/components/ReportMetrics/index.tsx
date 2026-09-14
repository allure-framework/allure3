import { ArrowButton, Loadable, PageLoader } from "@allurereport/web-components";
import { Fragment } from "preact";
import { useState } from "preact/hooks";

import { useI18n } from "@/stores";
import {
  metricHistoryRows,
  metricSummaryRows,
  metricRows,
  type MetricSummaryRow,
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

const groupedMetricRows = (rows: MetricSummaryRow[]) => {
  const groups = new Map<string, MetricSummaryRow[]>();

  rows.forEach((row) => {
    const category = row.groupTitle ?? row.group ?? "other";

    groups.set(category, [...(groups.get(category) ?? []), row]);
  });

  return [...groups.entries()];
};

const formatGroupLabel = (group: string) =>
  group
    .replaceAll(".", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());

const MetricHistoryDetails = ({
  row,
  historyRows,
}: {
  row: MetricRow;
  historyRows: ReturnType<typeof metricHistoryRows>;
}) => {
  const { t } = useI18n("charts");

  return (
    <section className={styles.historyDetails} aria-label={`${t("metrics.historyTitle")} ${row.title ?? row.key}`}>
      <div className={styles.detailsHeader}>
        <span className={styles.sectionTitle}>{t("metrics.historyTitle")}</span>
        <span className={styles.detailsMetric}>{row.title ?? row.key}</span>
      </div>
      <div className={styles.detailsValue}>
        <span className={styles.metricValue}>{formatValue(row.value, row.unit)}</span>
        {formatDelta(row)}
        <Sparkline values={row.trend} />
      </div>
      {historyRows.length === 0 ? (
        <div className={styles.emptyInline}>{t("metrics.noHistory")}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.historyTable}`}>
            <colgroup>
              <col className={styles.historyReportCol} />
              <col className={styles.historyDateCol} />
              <col className={styles.historyValueCol} />
              <col className={styles.historyDeltaCol} />
            </colgroup>
            <thead>
              <tr>
                <th>{t("metrics.table.report")}</th>
                <th>{t("metrics.table.date")}</th>
                <th>{t("metrics.table.value")}</th>
                <th>{t("metrics.table.delta")}</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((historyRow) => (
                <tr key={historyRow.uuid}>
                  <td>
                    {historyRow.url ? (
                      <a href={historyRow.url} target="_blank" rel="noreferrer">
                        {historyRow.name}
                      </a>
                    ) : (
                      historyRow.name
                    )}
                  </td>
                  <td>{t("metrics.date", { timestamp: historyRow.timestamp })}</td>
                  <td>{formatValue(historyRow.value, row.unit)}</td>
                  <td>{formatDelta({ delta: historyRow.delta, unit: row.unit, better: row.better })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

type SummaryValueField = "totalMs" | "avgMs" | "minMs" | "maxMs";
type MetricRowScope = "current" | "summary";

const metricRowId = (scope: MetricRowScope, key: string) => `${scope}:${key}`;
const metricDetailsId = (scope: MetricRowScope, key: string) =>
  `metrics-${scope}-history-${encodeURIComponent(key).replaceAll("%", "_")}`;

const ReportMetricsContent = ({ data }: { data: MetricsWidgetData }) => {
  const { t } = useI18n("charts");
  const { t: tEmpty } = useI18n("empty");
  const rows = metricRows(data);
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  const summaryRows = metricSummaryRows(data);
  const metricGroups = groupedMetricRows(summaryRows);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  const toggleRow = (id: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const renderHistoryRow = (row: MetricRow, colSpan: number, id: string) => {
    return (
      <tr
        aria-label={`${t("metrics.historyTitle")} ${row.title ?? row.key}`}
        className={styles.expandedRow}
        data-expanded="true"
        id={id}
      >
        <td colSpan={colSpan}>
          <div className={styles.expandedContent}>
            <MetricHistoryDetails row={row} historyRows={metricHistoryRows(data, row.key)} />
          </div>
        </td>
      </tr>
    );
  };

  if (rows.length === 0) {
    return <div className={styles.empty}>{tEmpty("no-metrics-results")}</div>;
  }

  return (
    <div className={styles.metrics} data-testid="metrics-view">
      <header className={styles.header}>
        <h1 className={styles.title}>{t("metrics.title")}</h1>
        <span className={styles.meta}>
          {t("metrics.summary", { groups: summaryRows.length, metrics: rows.length })}
        </span>
      </header>

      {summaryRows.length > 0 && (
        <section className={styles.section} aria-labelledby="metrics-phase-summary">
          <h2 className={styles.sectionTitle} id="metrics-phase-summary">
            {t("metrics.phaseSummary")}
          </h2>
          {metricGroups.map(([category, categoryRows]) => (
            <div className={styles.phaseGroup} key={category}>
              <h3 className={styles.groupTitle}>
                {category === "other" ? t("metrics.groups.other") : formatGroupLabel(category)}
              </h3>
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${styles.summaryTable}`}>
                  <colgroup>
                    <col className={styles.summaryMetricCol} />
                    <col className={styles.summaryCountCol} />
                    <col className={styles.summaryValueCol} />
                    <col className={styles.summaryValueCol} />
                    <col className={styles.summaryValueCol} />
                    <col className={styles.summaryValueCol} />
                    <col className={styles.summaryDeltaCol} />
                    <col className={styles.summaryTrendCol} />
                  </colgroup>
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
                    {categoryRows.map((row) => {
                      const metricRow = rowsByKey.get(row.key);
                      const rowId = metricRowId("summary", row.key);
                      const detailsId = metricDetailsId("summary", row.key);
                      const isExpanded = expandedKeys.has(rowId);

                      return (
                        <Fragment key={row.key}>
                          <tr
                            className={styles.expandableRow}
                            data-expanded={isExpanded}
                            onClick={() => toggleRow(rowId)}
                          >
                            <td>
                              <button
                                aria-controls={detailsId}
                                aria-expanded={isExpanded}
                                className={styles.metricButton}
                                type="button"
                              >
                                <ArrowButton
                                  className={styles.rowArrow}
                                  isOpened={isExpanded}
                                  tag="span"
                                  buttonSize="s"
                                />
                                <span className={styles.metricName}>{row.title ?? row.key}</span>
                              </button>
                            </td>
                            <td>{typeof row.count === "number" ? formatValue(row.count) : ""}</td>
                            {(["totalMs", "avgMs", "minMs", "maxMs"] as SummaryValueField[]).map((field) => (
                              <td key={field}>
                                {typeof row[field] === "number" ? formatValue(row[field], row.unit) : ""}
                              </td>
                            ))}
                            <td>{formatDelta({ delta: row.delta, unit: row.unit, better: row.better })}</td>
                            <td>
                              <Sparkline values={row.trend} />
                            </td>
                          </tr>
                          {isExpanded && metricRow && renderHistoryRow(metricRow, 8, detailsId)}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}

      <details className={styles.section} open={summaryRows.length === 0}>
        <summary className={styles.sectionTitle}>{t("metrics.currentValues")}</summary>
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.currentTable}`}>
            <colgroup>
              <col className={styles.currentMetricCol} />
              <col className={styles.currentValueCol} />
              <col className={styles.currentDeltaCol} />
              <col className={styles.currentSourceCol} />
            </colgroup>
            <thead>
              <tr>
                <th>{t("metrics.table.metric")}</th>
                <th>{t("metrics.table.value")}</th>
                <th>{t("metrics.table.delta")}</th>
                <th>{t("metrics.table.source")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowId = metricRowId("current", row.key);
                const detailsId = metricDetailsId("current", row.key);
                const isExpanded = expandedKeys.has(rowId);

                return (
                  <Fragment key={row.key}>
                    <tr className={styles.expandableRow} data-expanded={isExpanded} onClick={() => toggleRow(rowId)}>
                      <td>
                        <button
                          aria-controls={detailsId}
                          aria-expanded={isExpanded}
                          className={styles.metricButton}
                          type="button"
                        >
                          <ArrowButton className={styles.rowArrow} isOpened={isExpanded} tag="span" buttonSize="s" />
                          <span>
                            <span className={styles.metricName}>{row.title ?? row.key}</span>
                            {row.group && <span className={styles.metricGroup}>{row.group}</span>}
                          </span>
                        </button>
                      </td>
                      <td>{formatValue(row.value, row.unit)}</td>
                      <td>{formatDelta(row)}</td>
                      <td>{row.source ?? ""}</td>
                    </tr>
                    {isExpanded && renderHistoryRow(row, 4, detailsId)}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
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
