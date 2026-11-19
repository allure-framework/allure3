import { readLocalStorage, writeLocalStorage } from "@allurereport/web-commons";
import {
  ArrowButton,
  Button,
  Counter,
  IconButton,
  LazyComponent,
  Loadable,
  PageLoader,
  SearchBox,
  TooltipWrapper,
  allureIcons,
} from "@allurereport/web-components/core";
import { Fragment } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import { NavTabs, NavTabsList, NavTab, useNavTabsContext } from "@/components/NavTabs";
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

import { deltaDirection, formatValue } from "./format";

import * as styles from "./styles.scss";

const loadMetricsTimeline = () => import(/* webpackChunkName: "chart-metrics-timeline" */ "./MetricsTimeline");

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

    const group = groups.get(category);
    if (group) group.push(row);
    else groups.set(category, [row]);
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

const favoritesStorageKey = "allure.metrics.favorites";

type MetricFavorites = { keys: string[]; only: boolean };

const parseFavorites = (value: string | null): MetricFavorites => {
  try {
    const saved: unknown = JSON.parse(value ?? "null");
    if (
      saved &&
      typeof saved === "object" &&
      "keys" in saved &&
      Array.isArray(saved.keys) &&
      saved.keys.every((key) => typeof key === "string") &&
      "only" in saved &&
      typeof saved.only === "boolean"
    ) {
      return { keys: saved.keys, only: saved.only };
    }
  } catch {
    // Ignore malformed saved preferences.
  }
  return { keys: [], only: false };
};

const ReportMetricsTable = ({ data, rows }: { data: MetricsWidgetData; rows: MetricRow[] }) => {
  const { t } = useI18n("charts");
  const { t: tEmpty } = useI18n("empty");
  const rowsByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);
  const summaryRows = useMemo(() => metricSummaryRows(rows), [rows]);
  const [query, setQuery] = useState("");
  const [{ favorites, focusTarget, inMemory }, setFavoriteState] = useState<{
    favorites: MetricFavorites;
    focusTarget?: string;
    inMemory?: boolean;
  }>(() => ({ favorites: parseFavorites(readLocalStorage(favoritesStorageKey)) }));
  const tableRef = useRef<HTMLDivElement>(null);
  const favoriteKeys = new Set(favorites.keys);
  const favoritesCount = rows.filter(({ key }) => favoriteKeys.has(key)).length;
  const search = query.trim().toLowerCase();
  const matches = ({ key, title }: Pick<MetricSummaryRow, "key" | "title">) =>
    (!favorites.only || favoriteKeys.has(key)) &&
    (!search || key.toLowerCase().includes(search) || (title?.toLowerCase().includes(search) ?? false));
  const currentRows = rows.filter(matches);
  const visibleSummary = summaryRows.filter(matches);
  const pinnedSummary = visibleSummary.filter((row) => favoriteKeys.has(row.key));
  const metricGroups = groupedMetricRows(visibleSummary.filter((row) => !favoriteKeys.has(row.key)));
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const syncFavorites = (event: StorageEvent) => {
      if (!inMemory && (event.key === favoritesStorageKey || event.key === null)) {
        const active = document.activeElement;
        const focusTarget =
          active instanceof HTMLButtonElement && tableRef.current?.contains(active)
            ? active.dataset.metricFavorite
            : undefined;
        setFavoriteState({ favorites: parseFavorites(readLocalStorage(favoritesStorageKey)), focusTarget });
      }
    };

    window.addEventListener("storage", syncFavorites);
    return () => window.removeEventListener("storage", syncFavorites);
  }, [inMemory]);

  const updateFavorites = (change: (current: MetricFavorites) => MetricFavorites, focusTarget?: string) => {
    const stored = inMemory ? null : readLocalStorage(favoritesStorageKey);
    const next = change(stored === null ? favorites : parseFavorites(stored));
    const saved = writeLocalStorage(favoritesStorageKey, JSON.stringify(next));
    setFavoriteState({ favorites: next, focusTarget, inMemory: !saved });
  };

  useLayoutEffect(() => {
    if (focusTarget === undefined) return;

    const buttons = tableRef.current?.querySelectorAll<HTMLButtonElement>("button[data-metric-favorite]");
    const button = Array.from(buttons ?? []).find(
      (candidate) => candidate.dataset.metricFavorite === focusTarget && !candidate.closest("details:not([open])"),
    );
    (button ?? tableRef.current?.querySelector<HTMLButtonElement>("button[data-testid='metrics-favorites']"))?.focus();
  }, [favorites, focusTarget]);

  const renderStar = (scope: MetricRowScope, row: Pick<MetricSummaryRow, "key" | "title">) => {
    const isFavorite = favoriteKeys.has(row.key);
    const label = t(isFavorite ? "metrics.removeFavorite" : "metrics.addFavorite", { name: row.title ?? row.key });
    const id = metricRowId(scope, row.key);

    return (
      <TooltipWrapper tooltipText={label}>
        <IconButton
          aria-label={label}
          aria-pressed={isFavorite}
          data-metric-favorite={id}
          icon={isFavorite ? allureIcons.solidStar : allureIcons.lineStar}
          size="s"
          iconSize="s"
          style="ghost"
          onClick={(event) => {
            event.stopPropagation();
            const target = event.currentTarget === document.activeElement ? id : undefined;
            updateFavorites((current) => {
              const keys = new Set(current.keys);
              if (isFavorite) keys.delete(row.key);
              else keys.add(row.key);
              return { ...current, keys: [...keys] };
            }, target);
          }}
        />
      </TooltipWrapper>
    );
  };

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

  const renderSummary = (categoryRows: MetricSummaryRow[]) => (
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
                <tr className={styles.expandableRow} data-expanded={isExpanded} onClick={() => toggleRow(rowId)}>
                  <td>
                    <div className={styles.metricCell}>
                      {renderStar("summary", row)}
                      <button
                        aria-controls={detailsId}
                        aria-expanded={isExpanded}
                        className={styles.metricButton}
                        type="button"
                      >
                        <ArrowButton className={styles.rowArrow} isOpened={isExpanded} tag="span" buttonSize="s" />
                        <span className={styles.metricName}>{row.title ?? row.key}</span>
                      </button>
                    </div>
                  </td>
                  <td>{typeof row.count === "number" ? formatValue(row.count) : ""}</td>
                  {(["totalMs", "avgMs", "minMs", "maxMs"] as SummaryValueField[]).map((field) => (
                    <td key={field}>{typeof row[field] === "number" ? formatValue(row[field], row.unit) : ""}</td>
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
  );

  const renderCurrent = () => (
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
          {currentRows.map((row) => {
            const rowId = metricRowId("current", row.key);
            const detailsId = metricDetailsId("current", row.key);
            const isExpanded = expandedKeys.has(rowId);

            return (
              <Fragment key={row.key}>
                <tr className={styles.expandableRow} data-expanded={isExpanded} onClick={() => toggleRow(rowId)}>
                  <td>
                    <div className={styles.metricCell}>
                      {renderStar("current", row)}
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
                    </div>
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
  );

  return (
    <div ref={tableRef}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <SearchBox
            placeholder={t("metrics.search")}
            clearLabel={t("metrics.clearSearch")}
            value={query}
            onChange={setQuery}
            changeDebounce={150}
          />
        </div>
        <Button
          text={t("metrics.favorites")}
          icon={favorites.only ? allureIcons.solidStar : allureIcons.lineStar}
          style={favorites.only ? "raised" : "ghost"}
          aria-pressed={favorites.only}
          data-testid="metrics-favorites"
          trailingSlot={<Counter count={favoritesCount} size="s" />}
          onClick={() => updateFavorites((current) => ({ ...current, only: !favorites.only }))}
        />
      </div>

      {currentRows.length === 0 && (
        <output className={styles.empty}>
          {favorites.only && favoritesCount === 0
            ? t("metrics.noFavorites")
            : search
              ? t("metrics.noMatches")
              : tEmpty("no-metrics-results")}
        </output>
      )}

      {visibleSummary.length > 0 && (
        <section className={styles.section} aria-labelledby="metrics-phase-summary">
          <h2 className={styles.sectionTitle} id="metrics-phase-summary">
            {t("metrics.phaseSummary")}
          </h2>
          {pinnedSummary.length > 0 && (
            <section className={styles.phaseGroup} aria-labelledby="metrics-favorites-heading">
              <h3 className={styles.groupTitle} id="metrics-favorites-heading">
                {t("metrics.favorites")}
              </h3>
              {renderSummary(pinnedSummary)}
            </section>
          )}
          {metricGroups.map(([category, categoryRows]) => (
            <div className={styles.phaseGroup} key={category}>
              <h3 className={styles.groupTitle}>
                {category === "other" ? t("metrics.groups.other") : formatGroupLabel(category)}
              </h3>
              {renderSummary(categoryRows)}
            </div>
          ))}
        </section>
      )}

      <details className={styles.section} hidden={currentRows.length === 0}>
        <summary className={styles.sectionTitle}>{t("metrics.currentValues")}</summary>
        {currentRows.length > 0 && renderCurrent()}
      </details>
    </div>
  );
};

const ReportMetricsContent = ({ data }: { data: MetricsWidgetData }) => {
  const { t } = useI18n("charts");
  const { currentTab } = useNavTabsContext();
  const [root, setRoot] = useState<string>();
  const rows = useMemo(() => metricRows(data), [data]);
  return (
    <div className={styles.metrics} data-testid="metrics-view">
      <header className={styles.header}>
        <h1 className={styles.title}>{t("metrics.title")}</h1>
        <span className={styles.meta}>{t("metrics.summary", { groups: rows.length, metrics: rows.length })}</span>
      </header>
      <div className={styles.card}>
        <div className={styles.tabs}>
          <NavTabsList>
            <NavTab id="table">{t("metrics.tableView")}</NavTab>
            <NavTab id="timeline">{t("metrics.timelineView")}</NavTab>
          </NavTabsList>
        </div>
        <div hidden={currentTab !== "table"} className={styles.view}>
          <ReportMetricsTable data={data} rows={rows} />
        </div>
        {currentTab === "timeline" && (
          <LazyComponent
            loader={loadMetricsTimeline}
            componentProps={{ data, selectedRoot: root, onSelectRoot: setRoot }}
            fallback={<PageLoader />}
            errorMessage={t("loadError")}
            retryLabel={t("retry")}
          />
        )}
      </div>
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
      renderData={(data) =>
        data ? (
          <NavTabs initialTab="table">
            <ReportMetricsContent data={data} />
          </NavTabs>
        ) : (
          <></>
        )
      }
    />
  );
};
