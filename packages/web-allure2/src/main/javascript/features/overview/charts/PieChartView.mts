import { getSuccessRate, getSuccessRateTotal } from "@allurereport/core-api";

import "./PieChartView.scss";
import { interpolate } from "d3-interpolate";
import { arc, pie } from "d3-shape";

import translate from "../../../helpers/t.mts";
import { createElement, createFragment } from "../../../shared/dom.mts";
import BaseChartView from "../../../shared/ui/BaseChartView.mts";
import TooltipView from "../../../shared/ui/TooltipView.mts";
import { values } from "../../../utils/statuses.mts";

const PADDING = 5;

type PieChartStatistic = Record<string, number> & {
  total?: number;
  passed?: number;
  failed?: number;
  broken?: number;
};

type PieChartDatum = {
  name: string;
  part: number;
  value: number;
};

type PieChartOptions = {
  showLegend?: boolean;
  statistic?: PieChartStatistic;
};

class PieChartView extends BaseChartView {
  declare statistic: PieChartStatistic;

  declare showLegend: boolean;

  declare arc: import("d3-shape").Arc<SVGPathElement, import("d3-shape").PieArcDatum<PieChartDatum>>;

  declare pie: import("d3-shape").Pie<unknown, PieChartDatum>;

  declare data: PieChartDatum[];

  private releaseTooltips: (() => void)[] = [];
  private descriptionIndex = 0;

  constructor(options: PieChartOptions = {}) {
    super(options);
    this.statistic = options.statistic || {};
    this.showLegend = options.showLegend || false;
    this.arc = arc<SVGPathElement, import("d3-shape").PieArcDatum<PieChartDatum>>();
    this.pie = pie<PieChartDatum>()
      .sort(null)
      .value((d: PieChartDatum) => d.value);
    this.getChartData();
  }

  getChartData() {
    const total = this.statistic.total || 0;
    const stats = this.statistic;
    this.data = values
      .map((key) => ({
        name: key.toUpperCase(),
        value: stats[key] || 0,
        part: total > 0 ? (stats[key] || 0) / total : 0,
      }))
      .filter((item): item is PieChartDatum => item.value > 0);
  }
  setupViewport() {
    super.setupViewport();
    if (this.showLegend) {
      this.el.appendChild(this.getLegendElement());
    }
    return this.svg;
  }
  drawChart() {
    const focusedKey = this.el.contains(document.activeElement)
      ? (document.activeElement as HTMLElement).dataset.tooltipKey
      : undefined;
    this.clearTooltips();
    const data = this.data;
    const arcGenerator = this.arc as unknown as (datum: import("d3-shape").PieArcDatum<PieChartDatum>) => string | null;
    const { width, height } = this.el.getBoundingClientRect();
    const radius = Math.min(width, height) / 2 - 2 * PADDING;
    const topOffset = height / 2;
    let leftOffset = width / 2;
    if (this.showLegend) {
      leftOffset -= 70;
    }
    this.arc.innerRadius(0.8 * radius).outerRadius(radius);
    this.svg = this.setupViewport();
    const sectors = this.svg
      .select(".chart__plot")
      .attr("transform", `translate(${leftOffset},${topOffset})`)
      .selectAll<SVGPathElement, import("d3-shape").PieArcDatum<PieChartDatum>>(".chart__arc")
      .data(this.pie(data))
      .enter()
      .append("path")
      .attr("class", (d) => `chart__arc chart__arc_status_${d.data.name.toLowerCase()}`);

    sectors.each((_datum, index, nodes) => {
      const sector = nodes[index];
      const datum = sectors.data()[index];

      this.bindExplanation(sector, this.getSliceText(datum.data), `slice-${datum.data.name}`);
    });

    const caption = this.svg
      .select(".chart__plot")
      .append("text")
      .classed("chart__caption", true)
      .attr("dy", "0.4em")
      .text(this.getChartTitle());
    const captionNode = caption.node();

    if (captionNode) {
      const label = translate("chart.status.successRate", { hash: { rate: this.getChartTitle() } });
      const key = !this.statistic.total
        ? "noResults"
        : !getSuccessRateTotal(this.statistic)
          ? "noEligibleResults"
          : "successRateDescription";
      const explanation = translate(`chart.status.${key}`);

      this.bindExplanation(captionNode, `${label}\n${explanation}`, "caption", label, label);
    }

    if (focusedKey) {
      this.el.querySelector<SVGElement & { focus(): void }>(`[data-tooltip-key="${focusedKey}"]`)?.focus();
    }

    if (this.firstRender) {
      (
        sectors as unknown as {
          transition: () => {
            duration: (value: number) => {
              attrTween: (
                name: string,
                factory: (datum: import("d3-shape").PieArcDatum<PieChartDatum>) => (time: number) => string | null,
              ) => void;
            };
          };
        }
      )
        .transition()
        .duration(750)
        .attrTween("d", (d: import("d3-shape").PieArcDatum<PieChartDatum>) => {
          const startAngleFn = interpolate(0, d.startAngle);
          const endAngleFn = interpolate(0, d.endAngle);
          return (t) =>
            arcGenerator({
              ...d,
              startAngle: startAngleFn(t),
              endAngle: endAngleFn(t),
            });
        });
    } else {
      sectors.attr("d", (d) => arcGenerator(d));
    }
  }
  formatNumber(n: number) {
    return (Math.floor(n * 100) / 100).toString();
  }
  getChartTitle() {
    const { passed = 0, total = 0 } = this.statistic;

    if (!total) {
      return "???";
    }
    if (!passed) {
      return "0%";
    }
    return `${this.formatNumber(getSuccessRate(this.statistic) * 100)}%`;
  }
  private getSliceText(data: PieChartDatum) {
    const count = data.value || 0;
    const percent = this.formatNumber((data.part || 0) * 100);

    return translate("chart.status.statusSlice", {
      hash: { count, percent, status: translate(`status.${data.name.toLowerCase()}`) },
    });
  }

  private clearTooltips() {
    this.releaseTooltips.splice(0).forEach((release) => release());
  }

  private bindExplanation(anchor: Element, text: string, key: string, label = text, tooltipText = text) {
    const tooltip = new TooltipView({ position: "top" });
    tooltip.className = "tooltip pie-chart-tooltip";
    tooltip.positionClassBase = "tooltip";
    tooltip.el.setAttribute("role", "tooltip");
    const description = document.createElementNS("http://www.w3.org/2000/svg", "desc");
    description.id = `${this.cid}-description-${++this.descriptionIndex}`;
    description.textContent = text;
    this.el.querySelector("svg")?.appendChild(description);
    anchor.setAttribute("tabindex", "0");
    anchor.setAttribute("role", "img");
    anchor.setAttribute("aria-label", label);
    anchor.setAttribute("aria-describedby", description.id);
    anchor.setAttribute("data-tooltip-key", key);
    let focused = false;
    let hovered = false;
    let tooltipHovered = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const hide = () => {
      tooltip.hide();
      document.removeEventListener("keydown", onKeyDown);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        tooltipHovered = false;
        clearTimeout(timer);
        hide();
      }
    };
    const show = () => {
      clearTimeout(timer);
      tooltip.show(createFragment(tooltipText), anchor);
      document.addEventListener("keydown", onKeyDown);
    };
    const leave = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!focused && !hovered && !tooltipHovered) {
          hide();
        }
      }, 100);
    };
    const onEnter = () => {
      hovered = true;
      show();
    };
    const onLeave = () => {
      hovered = false;
      leave();
    };
    const onFocus = () => {
      focused = true;
      show();
    };
    const onBlur = () => {
      focused = false;
      leave();
    };
    const onTooltipEnter = () => {
      tooltipHovered = true;
      clearTimeout(timer);
    };
    const onTooltipLeave = () => {
      tooltipHovered = false;
      leave();
    };

    anchor.addEventListener("mouseenter", onEnter);
    anchor.addEventListener("mouseleave", onLeave);
    anchor.addEventListener("focus", onFocus);
    anchor.addEventListener("blur", onBlur);
    tooltip.el.addEventListener("mouseenter", onTooltipEnter);
    tooltip.el.addEventListener("mouseleave", onTooltipLeave);
    this.releaseTooltips.push(() => {
      clearTimeout(timer);
      hide();
      tooltip.destroy();
      description.remove();
      anchor.removeEventListener("mouseenter", onEnter);
      anchor.removeEventListener("mouseleave", onLeave);
      anchor.removeEventListener("focus", onFocus);
      anchor.removeEventListener("blur", onBlur);
      tooltip.el.removeEventListener("mouseenter", onTooltipEnter);
      tooltip.el.removeEventListener("mouseleave", onTooltipLeave);
    });
  }

  detachFromDom() {
    this.clearTooltips();
    super.detachFromDom();
  }

  destroy() {
    this.clearTooltips();
    super.destroy();
  }

  getLegendElement() {
    return createElement("div", {
      className: "chart__legend",
      children: values.map((status) => {
        const row = createElement("div", {
          attrs: { "data-status": status },
          className: "chart__legend-row",
          children: [
            createElement("span", {
              className: `chart__legend-icon chart__legend-icon_status_${status}`,
            }),
            ` ${translate(`status.${status}`)}`,
          ],
        });
        const count = this.statistic[status] ?? 0;

        this.bindExplanation(
          row,
          this.getSliceText({
            name: status,
            value: count,
            part: this.statistic.total ? count / this.statistic.total : 0,
          }),
          `legend-${status}`,
        );

        return row;
      }),
    });
  }
}

export default PieChartView;
