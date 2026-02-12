import { formatDuration } from "@allurereport/core-api";
import type { Axis } from "d3-axis";
import { axisBottom } from "d3-axis";
import type { BrushSelection, D3BrushEvent } from "d3-brush";
import { brushX as d3BrushX } from "d3-brush";
import { scaleLinear } from "d3-scale";
import { select as d3Select } from "d3-selection";
import type { FunctionComponent } from "preact";
import { useEffect, useRef } from "preact/hooks";
import styles from "./styles.scss";
import { minPositive, useStateRef } from "./utils.js";

type DurationRangeProps = {
  width?: number;
  height?: number;
  margins?: { top: number; right: number; bottom: number; left: number };
  domainRange: [number, number] | readonly [number, number];
  currentSelection: [number, number] | readonly [number, number];
  tickFormat: (domainValue: number, index: number) => string;
  onChange?: (selectionStart: number, selectionEnd: number) => void;
  onReset?: () => void;
  selectedTestsCount: number;
  totalTestsCount: number;
  translations: {
    selected: (props: { count: number; percentage: string; minDuration: string; maxDuration: string }) => string;
  };
  transitionDuration?: number;
};

const d3AxisBottom = (): Axis<number> => {
  // @ts-expect-error - axisBottom from d3-axis can be called without scale initially, but types are not correct
  return axisBottom();
};

const DEFAULT_MARGINS = { top: 0, right: 0, bottom: 20, left: 0 };
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 20;
const HANDLE_SIZE = 24;
const noop = () => {};

export const DurationRange: FunctionComponent<DurationRangeProps> = (props) => {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    margins = DEFAULT_MARGINS,
    domainRange,
    currentSelection,
    tickFormat,
    onChange = noop,
    onReset = noop,
    selectedTestsCount,
    totalTestsCount,
    translations,
    transitionDuration = 300,
  } = props;

  const brushWidth = minPositive(width - margins.left - margins.right);
  const brushHeight = minPositive(height - margins.top - margins.bottom);

  const [scaleRef, scale, setScale] = useStateRef(() => scaleLinear().domain(domainRange).range([0, brushWidth]));

  useEffect(() => {
    setScale(() => scaleLinear().domain(domainRange).range([0, brushWidth]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainRange, brushWidth]);

  const svgRef = useRef<SVGSVGElement>(null);
  const brusherMarginsRef = useRef<SVGGElement>(null);
  const gridBackgroundRef = useRef<SVGRectElement>(null);
  const xGridRef = useRef<SVGGElement>(null);
  const xAxisRef = useRef<SVGGElement>(null);
  const brushRef = useRef<SVGGElement>(null);
  const onChangeRef = useRef(onChange);
  const onResetRef = useRef(onReset);

  // Keep refs in sync with props
  useEffect(() => {
    onChangeRef.current = onChange;
    onResetRef.current = onReset;
  }, [onChange, onReset]);

  // Initialize D3 elements that don't depend on DOM or props
  const xGridAxisRef = useRef(d3AxisBottom().tickFormat(() => ""));
  const xAxisAxisRef = useRef(d3AxisBottom().tickPadding(0));

  const brushBehaviorRef = useRef(
    d3BrushX<SVGGElement>()
      .handleSize(HANDLE_SIZE)
      .on("end", (event: D3BrushEvent<SVGGElement>) => {
        if (!event.sourceEvent || !scaleRef.current || !onChangeRef.current) {
          return;
        }

        const hasSelection = event.selection && event.selection.length === 2;

        if (!hasSelection) {
          const [domainX0, domainX1] = scaleRef.current.domain();
          onChangeRef.current(domainX0, domainX1);
          return;
        }

        const [x0, x1] = event.selection!.map((d) => scale.invert(d as number));
        onChangeRef.current(x0, x1);
      }),
  );

  // Update when props change
  useEffect(() => {
    if (!svgRef.current || !scale) {
      return;
    }
    if (!domainRange || domainRange[1] <= domainRange[0]) {
      return;
    }

    // Generate evenly distributed tick values
    const tickCount = 7;
    const [min, max] = domainRange;
    const step = (max - min) / (tickCount - 1);
    const tickValues: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      tickValues.push(min + step * i);
    }
    // Ensure exact boundaries (handles floating point precision)
    tickValues[0] = min;
    tickValues[tickCount - 1] = max;

    // Update axes
    xAxisAxisRef.current.scale(scale).tickFormat(tickFormat).tickValues(tickValues);

    xGridAxisRef.current.scale(scale).tickSize(-brushHeight).tickValues(tickValues);

    // Update margins transform
    d3Select(brusherMarginsRef.current).attr("transform", `translate(${margins.left},${margins.top})`);

    // Update grid background
    d3Select(gridBackgroundRef.current)
      .exit()
      .transition()
      .duration(transitionDuration)
      .attr("width", 0)
      .attr("height", 0);

    // Update grid
    if (xGridRef.current) {
      d3Select(xGridRef.current).attr("transform", `translate(0,${brushHeight})`);
      d3Select(xGridRef.current).call(xGridAxisRef.current);
    }

    // Update axis
    if (xAxisRef.current) {
      d3Select(xAxisRef.current).attr("transform", `translate(0,${brushHeight})`);
      d3Select(xAxisRef.current).call(xAxisAxisRef.current).selectAll("text").attr("y", 8);
    }

    // Update brush
    if (brushRef.current) {
      const brushSelection = d3Select(brushRef.current);

      brushSelection.select(".selection").attr("rx", 2).attr("ry", 2);

      brushSelection.call(
        // @ts-expect-error - this is fine
        brushBehaviorRef.current.extent([
          [0, 0],
          [brushWidth, brushHeight],
        ]),
      );

      // Update brush selection
      const selection: BrushSelection = [
        scale(currentSelection[0] ?? domainRange[0]),
        scale(currentSelection[1] ?? domainRange[1]),
      ];

      brushBehaviorRef.current.move(brushSelection as any, selection);
    }
  }, [margins, scale, domainRange, currentSelection, tickFormat, brushWidth, brushHeight, transitionDuration]);

  const selectedTestsPercentage = ((selectedTestsCount / totalTestsCount) * 100).toFixed(2);

  return (
    <svg ref={svgRef} className={styles.brusher} width={width} height={height + 14}>
      <g ref={brusherMarginsRef} className={styles.brusherMargins}>
        <rect ref={gridBackgroundRef} className={styles.gridBackground} />
        <g ref={brushRef} className={styles.brush} />
        <g className={styles.axises}>
          <g ref={xGridRef} className={styles.xGrid} />
          <g ref={xAxisRef} className={styles.xAxis} />
          <text x={brushWidth / 2} y={60} textAnchor="middle" className={styles.durationRangeText}>
            {translations.selected({
              count: selectedTestsCount,
              percentage: selectedTestsPercentage,
              minDuration: formatDuration(currentSelection[0]),
              maxDuration: formatDuration(currentSelection[1]),
            })}
          </text>
        </g>
      </g>
    </svg>
  );
};
