import { Button, DropdownButton, Menu, SvgIcon, allureIcons, useTooltip } from "@allurereport/web-components/core";
import { createPortal } from "preact/compat";
import { useId, useMemo, useRef, useState } from "preact/hooks";

import { useI18n } from "@/stores";
import { metricRows, type MetricsWidgetData } from "@/stores/metrics";

import { deltaDirection, formatValue } from "./format";
import { metricTimeline, type MetricInterval } from "./timeline";

import * as styles from "./timeline.scss";

const Interval = ({
  interval,
  start,
  duration,
  text,
  valueLabel,
  direction,
  visible,
  onHover,
  onFocus,
  onDismiss,
  onZoom,
}: {
  interval: MetricInterval;
  start: number;
  duration: number;
  text: string;
  valueLabel: string;
  direction: ReturnType<typeof deltaDirection>;
  visible: boolean;
  onHover: (index?: number) => void;
  onFocus: (index?: number) => void;
  onDismiss: () => void;
  onZoom: (start: number, stop: number) => void;
}) => {
  const { sample, lane } = interval;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const id = useId();
  useTooltip({ isVisible: visible, triggerRef, tooltipRef });
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.interval}
        data-direction={direction}
        data-testid="metric-interval"
        data-metric-key={sample.key}
        data-start={sample.start}
        data-stop={sample.stop}
        data-point={sample.start === sample.stop}
        aria-label={text}
        aria-describedby={visible ? id : undefined}
        style={{
          left: `${duration ? ((Math.max(sample.start, start) - start) / duration) * 100 : 0}%`,
          width: `${duration ? ((Math.min(sample.stop, start + duration) - Math.max(sample.start, start)) / duration) * 100 : 0}%`,
          top: `${lane * 36 + 2}px`,
        }}
        onMouseMove={() => onHover(interval.index)}
        onMouseLeave={() => onHover(undefined)}
        onFocus={() => onFocus(interval.index)}
        onBlur={() => onFocus(undefined)}
        onClick={() => onZoom(sample.start, sample.stop)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onDismiss();
          }
        }}
      >
        <span className={styles.caption}>
          <span aria-hidden="true">{direction === "good" ? "✓" : direction === "bad" ? "!" : "—"} </span>
          {sample.title ?? sample.key}
        </span>
        <span className={styles.elapsed} aria-hidden="true">
          {valueLabel}
        </span>
      </button>
      {visible &&
        createPortal(
          <div id={id} ref={tooltipRef} role="tooltip" className={styles.tooltip}>
            {text}
          </div>,
          document.body,
        )}
    </>
  );
};

export default function MetricsTimeline({
  data,
  selectedRoot,
  onSelectRoot,
}: {
  data: MetricsWidgetData;
  selectedRoot?: string;
  onSelectRoot: (root: string) => void;
}) {
  const { t } = useI18n("charts");
  const model = useMemo(() => metricTimeline(data, selectedRoot), [data, selectedRoot]);
  const [zoom, setZoom] = useState<{ root: string; start: number; stop: number }>();
  const view = zoom && zoom.root === model.root ? zoom : model;
  const duration = view.stop - view.start;
  const [hovered, setHovered] = useState<{ root: string; index: number }>();
  const [focused, setFocused] = useState<{ root: string; index: number }>();
  const activeIndex =
    focused?.root === model.root ? focused?.index : hovered?.root === model.root ? hovered?.index : undefined;
  const setHoveredIndex = (index?: number) =>
    setHovered((current) =>
      index === undefined
        ? undefined
        : current?.root === model.root && current.index === index
          ? current
          : { root: model.root!, index },
    );
  const setFocusedIndex = (index?: number) =>
    setFocused(index === undefined ? undefined : { root: model.root!, index });
  const dismissTooltip = () => {
    setHovered(undefined);
    setFocused(undefined);
  };
  const rows = useMemo(() => new Map(metricRows(data).map((row) => [row.key, row])), [data]);
  const title = (key: string) => rows.get(key)?.title ?? key;
  const zoomTo = (start: number, stop: number) => {
    if (stop <= start) return;
    dismissTooltip();
    setZoom({ root: model.root!, start, stop });
  };
  return (
    <section className={styles.timeline} aria-label={t("metrics.timelineView")} data-testid="metrics-timeline">
      <div className={styles.toolbar}>
        {model.roots.length > 0 && (
          <Menu
            size="l"
            placement="bottom-start"
            menuTriggerWrapper="span"
            menuTrigger={({ isOpened, onClick }) => (
              <DropdownButton
                style="outline"
                size="m"
                className={styles.rootPicker}
                isTextTruncated
                text={title(model.root!)}
                isExpanded={isOpened}
                onClick={onClick}
              />
            )}
          >
            <Menu.Section>
              {model.roots.map((root) => (
                <Menu.ItemWithCheckmark
                  key={root}
                  onClick={() => {
                    dismissTooltip();
                    setZoom(undefined);
                    onSelectRoot(root);
                  }}
                  isChecked={root === model.root}
                >
                  <span className={styles.rootChoice}>
                    {title(root)}
                    {title(root) !== root && <small className={styles.rootKey}>{root}</small>}
                  </span>
                </Menu.ItemWithCheckmark>
              ))}
            </Menu.Section>
          </Menu>
        )}
        <div className={styles.tools}>
          {zoom && zoom.root === model.root && (
            <Button
              style="ghost"
              size="m"
              icon={allureIcons.lineArrowsRefreshCcw1}
              text={t("metrics.resetZoom")}
              onClick={() => {
                dismissTooltip();
                setZoom(undefined);
              }}
            />
          )}
          <details className={styles.help}>
            <summary aria-label={t("metrics.timelineHelp")}>
              <SvgIcon id={allureIcons.lineGeneralInfoCircle} size="s" />
            </summary>
            <div>
              {t("metrics.timelineDescription")} {t("metrics.zoomHint")}
            </div>
          </details>
        </div>
      </div>
      <div className={styles.legend}>
        {(["good", "bad", "neutral"] as const).map((direction) => (
          <span key={direction} data-direction={direction}>
            <i aria-hidden="true" />
            {t(`metrics.${direction}`)}
          </span>
        ))}
      </div>
      {model.excluded > 0 && <p>{t("metrics.invalidIntervals", { count: model.excluded })}</p>}
      {!model.hasIntervals ? (
        <p>{t("metrics.noIntervals")}</p>
      ) : (
        <div className={styles.scroll}>
          <div className={styles.chart}>
            <div className={styles.axis}>
              {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
                <span key={fraction}>{formatValue(view.start - model.start + duration * fraction, "ms")}</span>
              ))}
            </div>
            {model.rows.map((row) => {
              const intervals = row.intervals.filter(({ sample }) =>
                sample.start === sample.stop
                  ? sample.start >= view.start && sample.stop <= view.stop
                  : sample.stop > view.start && sample.start < view.stop,
              );
              if (!intervals.length) return null;
              return (
                <div
                  className={styles.track}
                  key={row.depth}
                  data-depth={row.depth}
                  data-testid="metric-timeline-row"
                  style={{ height: `${row.lanes * 36}px` }}
                >
                  {intervals.map((interval) => {
                    const sample = interval.sample;
                    const metric = rows.get(sample.key)!;
                    const direction = deltaDirection(metric);
                    const previous = metric?.previousValue;
                    const delta = metric.delta;
                    const deltaLabel =
                      typeof delta === "number" && Number.isFinite(delta)
                        ? `${metric.count > 1 ? `Δ ${t("metrics.table.avg")} ` : ""}${delta > 0 ? "+" : ""}${formatValue(delta, metric.unit)}`
                        : undefined;
                    const valueLabel = `${formatValue(sample.value, sample.unit)}${deltaLabel ? ` (${deltaLabel})` : ""}`;
                    const text = [
                      title(sample.key),
                      sample.key,
                      t(`metrics.${direction}`),
                      `${t("metrics.table.value")}: ${formatValue(sample.value, sample.unit)}`,
                      `${t("metrics.interval")}: ${formatValue(sample.start - model.start, "ms")} – ${formatValue(sample.stop - model.start, "ms")}`,
                      `${t("metrics.table.avg")}: ${formatValue(metric!.value, metric?.unit)}`,
                      `${t("metrics.table.count")}: ${metric?.count}`,
                      previous === undefined
                        ? t("metrics.noHistory")
                        : `${t("metrics.previousValue")}: ${formatValue(previous, metric?.unit)}`,
                      metric?.delta === undefined
                        ? ""
                        : `${t("metrics.table.delta")}: ${formatValue(metric.delta, metric.unit)}`,
                    ]
                      .filter(Boolean)
                      .join("\n");
                    return (
                      <Interval
                        key={interval.index}
                        interval={interval}
                        start={view.start}
                        duration={duration}
                        text={text}
                        valueLabel={valueLabel}
                        direction={direction}
                        visible={activeIndex === interval.index}
                        onHover={setHoveredIndex}
                        onFocus={setFocusedIndex}
                        onDismiss={dismissTooltip}
                        onZoom={zoomTo}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
