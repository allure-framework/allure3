import type { Axis } from "d3-axis";
import { axisBottom } from "d3-axis";
import type { D3BrushEvent } from "d3-brush";
import { brushX as d3BrushX } from "d3-brush";
import type { ScaleTime } from "d3-scale";
import { select as d3Select } from "d3-selection";
import type { FunctionComponent } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import styles from "./styles.scss";
import { useStateRef } from "./utils.js";

export type TimeOverviewProps = {
  width?: number;
  height?: number;
  margins?: { top: number; right: number; bottom: number; left: number };
  scale: ScaleTime<number, number>;
  domainRange: [Date, Date] | readonly [Date, Date];
  currentSelection: [Date, Date] | readonly [Date, Date];
  tickFormat: (domainValue: Date, index: number) => string;
  onChange?: (selectionStart: Date, selectionEnd: Date) => void;
  onReset?: () => void;
};

const d3AxisBottom = (): Axis<Date> => {
  // @ts-expect-error - d3AxisBottom can be called without scale initially
  return axisBottom();
};

const DEFAULT_MARGINS = { top: 0, right: 0, bottom: 20, left: 0 };
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 20;
const HANDLE_SIZE = 24;
const noop = () => {};

export const TimeOverview: FunctionComponent<TimeOverviewProps> = (props) => {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    margins = DEFAULT_MARGINS,
    scale: scaleProp,
    domainRange,
    currentSelection,
    tickFormat,
    onChange = noop,
    onReset = noop,
  } = props;

  const [scaleRef, scale, setScale] = useStateRef(() => scaleProp.copy());

  useLayoutEffect(() => {
    setScale(() => {
      if (scaleRef.current.domain() === scaleProp.domain() && scaleRef.current.range() === scaleProp.range()) {
        return scaleRef.current;
      }

      return scaleProp.copy();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scaleProp]);

  const brushWidth = width - margins.left - margins.right;
  const brushHeight = height - margins.top - margins.bottom;

  useLayoutEffect(() => {
    setScale(() =>
      scaleProp
        .copy()
        .domain(domainRange ?? [])
        .range([0, brushWidth]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainRange, brushWidth, scaleProp]);

  const svgRef = useRef<SVGSVGElement>(null);
  const brusherMarginsRef = useRef<SVGGElement>(null);
  const gridBackgroundRef = useRef<SVGRectElement>(null);
  const xGridRef = useRef<SVGGElement>(null);
  const xAxisRef = useRef<SVGGElement>(null);
  const brushRef = useRef<SVGGElement>(null);
  const onChangeRef = useRef(onChange);
  const onResetRef = useRef(onReset);

  // Initialize D3 elements that don't depend on DOM or props
  const xGridAxisRef = useRef(d3AxisBottom().tickFormat(() => ""));
  const xAxisAxisRef = useRef(d3AxisBottom().tickPadding(0));
  const brushBehaviorRef = useRef(
    d3BrushX<SVGGElement>()
      .handleSize(HANDLE_SIZE)
      .on("end", (event: D3BrushEvent<Date>) => {
        if (!event.sourceEvent || !scaleRef.current || !onChangeRef.current) {
          return;
        }

        const hasSelection = event.selection && event.selection.length === 2;

        if (!hasSelection) {
          const [domainX0, domainX1] = scaleRef.current.domain();
          onChangeRef.current(domainX0, domainX1);
          return;
        }

        const [x0, x1] = event.selection!.map((d) => scaleRef.current.invert(d as number));
        onChangeRef.current(x0, x1);
      }),
  );

  // Keep refs in sync with props
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    onResetRef.current = onReset;
  }, [onChange, onReset]);

  // Update when props change
  useLayoutEffect(() => {
    if (!svgRef.current || !scale) {
      return;
    }

    if (!domainRange || domainRange[1] <= domainRange[0]) {
      return;
    }
    // Update axes
    xAxisAxisRef.current.scale(scale).tickFormat(tickFormat);

    xGridAxisRef.current.scale(scale).tickSize(-brushHeight);
    xGridAxisRef.current.ticks(7);

    // Update margins transform
    brusherMarginsRef.current?.setAttribute("transform", `translate(${margins.left},${margins.top})`);

    // Update grid background
    gridBackgroundRef.current?.setAttribute("width", String(brushWidth));
    gridBackgroundRef.current?.setAttribute("height", String(brushHeight));

    // Update grid
    if (xGridRef.current) {
      xGridRef.current.setAttribute("transform", `translate(0,${brushHeight})`);
      d3Select(xGridRef.current).call(xGridAxisRef.current);
    }

    // Update axis
    if (xAxisRef.current) {
      xAxisRef.current.setAttribute("transform", `translate(0,${brushHeight})`);
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
      const selection = [
        scale(currentSelection?.[0] ?? domainRange[0].getTime()),
        scale(currentSelection?.[1] ?? domainRange[1].getTime()),
      ] as [number, number];

      brushBehaviorRef.current.move(brushSelection as any, selection);
    }
  }, [brushWidth, brushHeight, margins, domainRange, currentSelection, tickFormat, scale]);

  return (
    <svg ref={svgRef} className={styles.brusher} width={width} height={height}>
      <g ref={brusherMarginsRef} className={styles.brusherMargins}>
        <rect ref={gridBackgroundRef} className={styles.gridBackground} />
        <g ref={brushRef} className={styles.brush} />
        <g className={styles.axises}>
          <g ref={xGridRef} className={styles.xGrid} />
          <g ref={xAxisRef} className={styles.xAxis} />
        </g>
      </g>
    </svg>
  );
};
