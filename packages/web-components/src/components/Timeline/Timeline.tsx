/* eslint-disable max-lines */
import { formatDuration, statusesList } from "@allurereport/core-api";
import { ascending as d3Ascending, max as d3Max, min as d3Min } from "d3-array";
import {
  type ScaleTime,
  scaleOrdinal as d3ScaleOrdinal,
  scalePoint as d3ScalePoint,
  scaleUtc as d3ScaleUtc,
} from "d3-scale";
import { pointer as d3Pointer, select as d3Select } from "d3-selection";
import { transition as d3Transition } from "d3-transition";
import type { FunctionComponent } from "preact";
import { createPortal } from "preact/compat";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "preact/hooks";
import { REDUCE_MOTION } from "../Charts/config.js";
import { DurationRange } from "./DurationRange.js";
import { GroupTooltip } from "./GroupTooltip.js";
import { useWidth } from "./ResponsiveWrapper/context.js";
import { ResponsiveWrapper } from "./ResponsiveWrapper/index.js";
import { SegmentTooltip } from "./SegmentTooltip.js";
import { TimeOverview } from "./TimeOverview.js";
import { useDurationRange } from "./hooks/useDurationRange.js";
import { useTooltip } from "./hooks/useTooltip.js";
import styles from "./styles.scss";
import type { FlatDataItem, TimelineChartData, TimelineData, TimelineDataGroup } from "./types.js";
import type { ZoomX, ZoomY } from "./utils.js";
import {
  ZoomEvent,
  d3AxisBottom,
  d3AxisLeft,
  d3AxisTop,
  isZoomXEqual,
  isZoomYEqual,
  minPositive,
  toTimelineData,
  useStateRef,
} from "./utils.js";

// @see https://github.com/d3/d3-selection/issues/185
d3Select.prototype.transition = d3Transition as any;

const getColorFromStatus = (status: "failed" | "broken" | "passed" | "skipped" | "unknown"): string => {
  const colorMap: Record<typeof status, string> = {
    // corresponds to --bg-support-capella
    failed: "var(--timeline-status-failed, #E8452CFF)",
    // corresponds to --bg-support-atlas
    broken: "var(--timeline-status-broken, #E88D2CFF)",
    // corresponds to --bg-support-castor
    passed: "var(--timeline-status-passed, #099337FF)",
    // corresponds to --bg-support-rau
    skipped: "var(--timeline-status-skipped, #7281A1FF)",
    // corresponds to --bg-support-skat
    unknown: "var(--timeline-status-unknown, #B92CE8FF)",
  };
  return colorMap[status] || colorMap.unknown;
};

const getPatternBgFromStatus = (status: "failed" | "broken" | "passed" | "skipped" | "unknown"): string => {
  const colorMap: Record<typeof status, string> = {
    // corresponds to --bg-support-capella-heavy
    failed: "var(--on-support-capella, #E8452CFF)",
    // corresponds to --bg-support-atlas
    broken: "var(--on-support-atlas, #E88D2CFF)",
    // corresponds to --bg-support-castor
    passed: "var(--on-support-castor, #099337FF)",
    // corresponds to --bg-support-rau
    skipped: "var(--on-support-rau, #7281A1FF)",
    // corresponds to --bg-support-skat
    unknown: "var(--on-support-skat, #B92CE8FF)",
  };
  return colorMap[status] || colorMap.unknown;
};

// Calculate border radius based on segment width
// Returns 4 for width >= 20, 0 for width < 4, and smoothly interpolates between
const getBorderRadius = (width: number): number => {
  if (width >= 20) {
    return 4;
  }

  if (width < 4) {
    return 0;
  }

  // Smooth interpolation between 4 and 20 using ease-out (slow end) for natural transition
  const normalized = (width - 4) / (20 - 4); // 0 to 1
  const eased = normalized * (2 - normalized); // Ease-out quadratic: fast start, slow end
  return eased * 4; // Scale to 0-4 range
};

type TimelineProps = {
  data?: TimelineData;
  width?: number;
  enableAnimations?: boolean;
  translations: {
    empty: string;
    selected: (props: { count: number; percentage: string; minDuration: string; maxDuration: string }) => string;
  };
};

const LEFT_MARGIN = 100;
const RIGHT_MARGIN = 100;
const TOP_MARGIN = 26;
const BOTTOM_MARGIN = 30;

// So that every the segment is visible even if it's very short
const MIN_SEGMENT_WIDTH = 2;
const OVERVIEW_HEIGHT = 20;
const MIN_LABEL_FONT_SIZE = 2;

const ANIMATION_DURATION = 500;
const TRANSITION_DURATION = 150;

const SEGMENT_HEIGHT = 20;
const GAP = 2;
const ROW_HEIGHT = SEGMENT_HEIGHT + GAP * 2;

const InnerTimeline: FunctionComponent<Omit<TimelineProps, "width">> = (props) => {
  const { data = [], translations } = props;
  const innerId = useId();

  const { durationRange, handleDurationChange, durationDomain } = useDurationRange(data);
  const width = useWidth();

  const svgRef = useRef<SVGSVGElement>(null);
  const graphRef = useRef<SVGGElement>(null);
  const axisesRef = useRef<SVGGElement>(null);
  const xAxisRef = useRef<SVGGElement>(null);
  const xGridRef = useRef<SVGGElement>(null);
  const grpAxisRef = useRef<SVGGElement>(null);

  const [yScaleRef, yScale, setYScale] = useStateRef(() => d3ScalePoint<string>());

  const [grpScaleRef, grpScale, setGrpScale] = useStateRef(() => d3ScaleOrdinal<string, number>());

  const xAxisRef_d3 = useRef(d3AxisBottom<Date>());
  const xGridRef_d3 = useRef(d3AxisTop<Date>());
  const grpAxisRef_d3 = useRef(d3AxisLeft<string>());
  const {
    tooltipRef: groupTooltipRef,
    isVisible: isGroupTooltipVisible,
    handleShowTooltip: handleGroupTooltipShow,
    handleHideTooltip: handleGroupTooltipHide,
    data: tooltipGroupData,
  } = useTooltip<{ id: string; name: string }>("bottom");
  const {
    tooltipRef: segmentTooltipRef,
    isVisible: isSegmentTooltipVisible,
    handleShowTooltip: handleSegmentTooltipShow,
    handleHideTooltip: handleSegmentTooltipHide,
    data: segmentTooltipData,
  } = useTooltip<FlatDataItem>("bottom");

  const animationDuration = !REDUCE_MOTION ? ANIMATION_DURATION : 0;
  const transitionDuration = !REDUCE_MOTION ? TRANSITION_DURATION : 0;
  const disableHoverRef = useRef(false);

  const nLines = data.length;

  const graphW = minPositive(width - LEFT_MARGIN - RIGHT_MARGIN);
  const graphH = minPositive(nLines * ROW_HEIGHT);
  const height = graphH + TOP_MARGIN + BOTTOM_MARGIN;

  const flatData = useMemo(() => {
    const result: FlatDataItem[] = [];

    for (const group of data) {
      for (const segment of group.segments) {
        result.push({
          groupId: group.id,
          groupName: group.name,
          label: segment.label,
          labelGroup: segment.labelGroup,
          timeRange: segment.timeRange,
          hidden: segment.hidden,
          val: segment.val,
          labelVal: segment.val,
          segment: segment,
          id: segment.id,
        });
      }
    }

    return result;
  }, [data]);

  const timelineGroups = useMemo(
    () =>
      data.map((d) => ({
        id: d.id,
        name: d.name,
      })),
    [data],
  );

  const defaultZoomX = useMemo(() => {
    return [d3Min(flatData, (d) => d.timeRange[0])!, d3Max(flatData, (d) => d.timeRange[1])!] as const;
  }, [flatData]);

  const [zoomX, setZoomX] = useState<ZoomX>(defaultZoomX as ZoomX);
  const [zoomY, setZoomY] = useState<ZoomY>([null, null]);

  const handleZoomXChange = useCallback((newZoomX: ZoomX) => {
    setZoomX((currentZoomX) => {
      if (isZoomXEqual(currentZoomX, newZoomX)) {
        return currentZoomX;
      }

      return newZoomX;
    });
  }, []);

  const handleZoomYChange = useCallback((newZoomY: ZoomY) => {
    setZoomY((currentZoomY) => {
      if (isZoomYEqual(currentZoomY, newZoomY)) {
        return currentZoomY;
      }

      return newZoomY;
    });
  }, []);

  const [xScaleRef, xScale, setXScale] = useStateRef<ScaleTime<number, number>>(() =>
    d3ScaleUtc().domain(defaultZoomX).range([0, graphW]).clamp(true),
  );

  useEffect(() => {
    setXScale(() => xScaleRef.current.copy().domain(defaultZoomX));
    handleZoomXChange(defaultZoomX as ZoomX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...defaultZoomX, handleZoomXChange]);

  // Update X scale when graph width changes
  useEffect(() => {
    setXScale(() => xScaleRef.current.copy().range([0, graphW]).clamp(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphW]);

  const timeRange = useMemo(() => {
    return [d3Min(flatData, (d) => d.timeRange[0])!, d3Max(flatData, (d) => d.timeRange[1])!] as const;
  }, [flatData]);

  // Initialize D3 elements and DOM structure
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const zoomHandler = (event: ZoomEvent) => {
      const { zoomX: newZoomX, zoomY: newZoomY } = event.detail;

      if (newZoomX) {
        handleZoomXChange(newZoomX);
      }

      if (newZoomY) {
        handleZoomYChange(newZoomY);
      }
    };

    // @ts-expect-error - zoom event is CUSTOM EVENT
    svgRef.current?.addEventListener("zoom", zoomHandler);

    if (!graphRef.current) {
      return;
    }

    // Setup zoom selection
    const graphSelection = d3Select(graphRef.current);

    const getPointerCoords = (event: MouseEvent) => d3Pointer(event, graphRef.current);

    graphSelection.on("mousedown", (event: MouseEvent) => {
      if (d3Select(window).on("mousemove.zoomRect") != null) {
        return;
      }

      const startCoords = getPointerCoords(event);

      if (startCoords[0] < 0 || startCoords[0] > graphW || startCoords[1] < 0 || startCoords[1] > graphH) {
        return;
      }

      // Disable hover while selecting area to zoom
      disableHoverRef.current = true;

      const rect = graphSelection.append("rect").attr("class", styles.zoomSelection);

      d3Select(window)
        .on("mousemove.zoomRect", (mouseMoveEvent: MouseEvent) => {
          mouseMoveEvent.stopPropagation();
          const pointerCoords = getPointerCoords(mouseMoveEvent);

          // Get the new coordinates of the zoom selection
          const newCoords = [
            Math.max(0, Math.min(graphW, pointerCoords[0])),
            Math.max(0, Math.min(graphH, pointerCoords[1])),
          ];

          rect
            .attr("x", Math.min(startCoords[0], newCoords[0]))
            .attr("y", Math.min(startCoords[1], newCoords[1]))
            .attr("width", Math.abs(newCoords[0] - startCoords[0]))
            .attr("height", Math.abs(newCoords[1] - startCoords[1]));
        })
        .on(
          "mouseup.zoomRect",
          (mouseUpEvent: MouseEvent) => {
            d3Select(window).on("mousemove.zoomRect", null).on("mouseup.zoomRect", null);
            rect.remove();

            disableHoverRef.current = false;

            // Get the end coordinates of the zoom selection
            const pointerCoords = getPointerCoords(mouseUpEvent);

            const endCoords = [
              Math.max(0, Math.min(graphW, pointerCoords[0])),
              Math.max(0, Math.min(graphH, pointerCoords[1])),
            ];

            if (startCoords[0] === endCoords[0] && startCoords[1] === endCoords[1]) {
              return;
            }

            const newDomainX = [startCoords[0], endCoords[0]]
              .sort(d3Ascending)
              .map((d) => xScaleRef.current.invert(d)) as [Date, Date];

            // do not zoom if the zoom is less than 10ms
            const isValidZoom = newDomainX[1].getTime() - newDomainX[0].getTime() > 10;

            if (!isValidZoom) {
              return;
            }

            svgRef.current?.dispatchEvent(
              new ZoomEvent({
                zoomX: newDomainX,
                zoomY: null,
              }),
            );
          },
          true,
        );

      event.stopPropagation();
    });

    return () => {
      // @ts-expect-error - zoom event is CUSTOM EVENT
      // eslint-disable-next-line react-hooks/exhaustive-deps
      svgRef.current?.removeEventListener("zoom", zoomHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphW, graphH, zoomY, flatData, handleZoomXChange, handleZoomYChange, grpScale]);

  // Update X scale when zoomX changes
  useEffect(() => {
    const currentZoomX = zoomX?.[0] && zoomX?.[1] ? zoomX : defaultZoomX;
    setXScale(() => xScaleRef.current.copy().domain(currentZoomX).range([0, graphW]).clamp(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomX, defaultZoomX, graphW]);

  // Update group axis
  useEffect(() => {
    grpAxisRef_d3.current.scale(grpScale);
  }, [grpScale, timelineGroups]);

  // Update group on group changes
  useEffect(() => {
    setGrpScale(() => {
      return grpScaleRef.current
        .copy()
        .domain(timelineGroups.map((g) => g.id))
        .range(timelineGroups.map((_, index) => ((index + 0.5) / nLines) * graphH));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineGroups, nLines, graphH]);

  // Update Y scale
  useEffect(() => {
    setYScale(() => {
      return yScaleRef.current
        .copy()
        .domain(timelineGroups.map((g) => g.id))
        .range([(graphH / timelineGroups.length) * 0.5, graphH * (1 - 0.5 / timelineGroups.length)]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineGroups, graphH, nLines]);

  // Render axes
  useEffect(() => {
    if (!svgRef.current || !xScale || graphH === 0 || !xAxisRef.current || !xGridRef.current) {
      return;
    }

    const [minXScale, maxXScale] = xScale.range();

    if (minXScale === maxXScale) {
      return;
    }

    // X axis
    xAxisRef_d3.current.scale(xScale);
    xAxisRef_d3.current.ticks(7);
    xAxisRef_d3.current.tickFormat((value: Date) => {
      if (!timeRange[0]) {
        return "";
      }
      return formatDuration(value.getTime() - timeRange[0].getTime());
    });

    xGridRef_d3.current
      .scale(xScale)
      .ticks(7)
      .tickFormat(() => "");

    const xAxisSelection = d3Select(xAxisRef.current);

    xAxisSelection
      .style("stroke-opacity", 0)
      .style("fill-opacity", 0)
      .attr("transform", `translate(0,${graphH})`)
      .transition()
      .duration(animationDuration)
      .call(xAxisRef_d3.current)
      .style("stroke-opacity", 1)
      .style("fill-opacity", 1);

    xGridRef_d3.current.tickSize(graphH);
    d3Select(xGridRef.current)
      .attr("transform", `translate(0,${graphH})`)
      .transition()
      .duration(animationDuration)
      .call(xGridRef_d3.current);

    // Y axis
    const fontVerticalMargin = 0.6;
    const labelDisplayRatio = Math.ceil((nLines * MIN_LABEL_FONT_SIZE) / Math.sqrt(2) / graphH / fontVerticalMargin);
    const tickVals = yScaleRef.current.domain().filter((d, i) => !(i % labelDisplayRatio));
    let fontSize = Math.min(12, (graphH / tickVals.length) * fontVerticalMargin * Math.sqrt(2));
    let maxChars = Math.ceil(RIGHT_MARGIN / (fontSize / Math.sqrt(2)));

    // Group axis
    const grpRange = grpScale.range();
    const minHeight = d3Min(grpRange, (d, i) => {
      return i > 0 ? d - grpRange[i - 1] : d * 2;
    });
    fontSize = Math.min(14, minPositive(minHeight) * fontVerticalMargin * Math.sqrt(2));
    maxChars = Math.floor(LEFT_MARGIN / (fontSize / Math.sqrt(2)));

    grpAxisRef_d3.current.tickFormat((d) => {
      const group = timelineGroups.find((g) => g.id === d);
      const label = group?.name ?? "";

      return label.length <= maxChars
        ? label
        : `${label.substring(0, (maxChars * 2) / 3)}...${label.substring(label.length - maxChars / 3, label.length)}`;
    });

    d3Select(grpAxisRef.current)
      .transition()
      .duration(animationDuration)
      .style("font-size", `${fontSize}px`)
      .call(grpAxisRef_d3.current as any);

    // Attach event handlers to tick text elements
    // D3 axis binds data to .tick elements, so we get the group ID from the parent tick
    d3Select(grpAxisRef.current)
      .selectAll(".tick")
      .each(function (d) {
        const groupId = d as string;
        const group = timelineGroups.find((g) => g.id === groupId);
        if (!group) {
          return;
        }

        d3Select(this)
          .select("text")
          .on("mouseover", (event) => {
            handleGroupTooltipShow(event.target as HTMLElement, group);
          })
          .on("mouseout", (event) => {
            handleGroupTooltipHide(event.target as HTMLElement);
          });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    graphW,
    graphH,
    nLines,
    animationDuration,
    timeRange,
    xScale,
    grpScale,
    timelineGroups,
    handleGroupTooltipShow,
    handleGroupTooltipHide,
  ]);

  // Render groups
  useEffect(() => {
    if (!graphRef.current || graphH === 0) {
      return;
    }

    const groups = d3Select(graphRef.current)
      .selectAll<SVGRectElement, TimelineDataGroup>(`rect.${styles.group}`)
      .data(timelineGroups, (d) => d.id);

    // Trigger exit animation for groups that are no longer on the chart
    groups.exit().transition().duration(animationDuration).style("stroke-opacity", 0).style("fill-opacity", 0).remove();

    // Trigger enter animation for new groups
    const newGroups = groups
      .enter()
      .append("rect")
      .attr("class", styles.group)
      .attr("x", 0)
      .attr("y", 0)
      .attr("height", 0)
      .attr("fill", "none")
      .style("fill-opacity", 0)
      .style("stroke-opacity", 0);

    // Update dimensions for new and existing groups
    groups
      .merge(newGroups)
      .transition()
      .duration(animationDuration)
      .attr("width", graphW)
      .attr("height", graphH / nLines)
      .attr("y", (d) => {
        const f = grpScale(d.id);

        if (!Number.isInteger(f)) {
          return 0;
        }

        return f - graphH / nLines / 2;
      })
      .style("fill-opacity", 1)
      .style("stroke-opacity", 1);
  }, [
    timelineGroups,
    graphW,
    graphH,
    nLines,
    animationDuration,
    grpScale,
    handleGroupTooltipShow,
    handleGroupTooltipHide,
  ]);

  const [minDuration, maxDuration] = durationRange;

  const filteredByDurationSegmentsCount = useMemo(() => {
    return flatData.filter((d: FlatDataItem) => {
      // Segment's group is not on the chart
      if (grpScale.domain().indexOf(d.groupId) === -1) {
        return false;
      }

      const duration = d.val;

      // Segment's duration is not in the current zoom range
      if (duration < minDuration || duration > maxDuration) {
        return false;
      }

      return true;
    }).length;
  }, [grpScale, flatData, minDuration, maxDuration]);

  const segments = useMemo(() => {
    return flatData.filter((d: FlatDataItem) => {
      // Segment's group is not on the chart
      if (grpScale.domain().indexOf(d.groupId) === -1) {
        return false;
      }

      const duration = d.val;

      // Segment's duration is not in the current zoom range
      if (duration < minDuration || duration > maxDuration) {
        return false;
      }

      const [x0, x1] = xScale.domain();
      const [start, end] = d.timeRange;

      // Segment is not in the current zoom range
      if (end < x0 || start > x1) {
        return false;
      }

      return true;
    });
  }, [grpScale, xScale, flatData, minDuration, maxDuration]);

  // Render timelines
  useEffect(() => {
    if (!graphRef.current || graphH === 0 || !xScale) {
      return;
    }

    const render = async () => {
      const graphSelection = d3Select(graphRef.current);
      const hoverEnlargeRatio = 0.1;

      let timelines = graphSelection
        .selectAll<SVGRectElement, FlatDataItem>(`rect.${styles.segment}`)
        .data(segments, (d) => d.id);

      if (segments.length === 0) {
        timelines.exit().remove();
        return;
      }
      // Trigger exit animation for segments that are no longer on the chart
      timelines.exit().transition().duration(animationDuration).style("fill-opacity", 0).remove();

      // Trigger enter animation for new segments
      const newSegments = timelines
        .enter()
        .append("rect")
        .attr("class", styles.segment)
        .attr("rx", 1)
        .attr("ry", 1)
        .attr("x", (d) => xScale(d.timeRange[0]))
        .attr("y", (d) => {
          return (yScale(d.groupId) || 0) - SEGMENT_HEIGHT / 2;
        })
        .attr("width", 0)
        .attr("height", 0)
        .style("fill", (d) => getColorFromStatus(d.segment.status))
        .style("fill-opacity", 0);

      // Add event handlers for new segments
      newSegments
        .on("mouseover", function (event: MouseEvent, d: FlatDataItem) {
          // Disable hover while selecting area to zoom
          if (disableHoverRef.current) {
            return;
          }

          const hoverEnlarge = SEGMENT_HEIGHT * hoverEnlargeRatio;

          d3Select(this)
            .transition()
            .duration(transitionDuration)
            .attr("x", xScaleRef.current(d.timeRange[0]) - hoverEnlarge / 2)
            .attr(
              "width",
              d3Max([MIN_SEGMENT_WIDTH, xScaleRef.current(d.timeRange[1]) - xScaleRef.current(d.timeRange[0])])! +
                hoverEnlarge,
            )
            .attr("y", (yScaleRef.current(d.groupId) || 0) - (SEGMENT_HEIGHT + hoverEnlarge) / 2)
            .attr("height", SEGMENT_HEIGHT + hoverEnlarge)
            .style("fill-opacity", 1);

          handleSegmentTooltipShow(event.target as HTMLElement, d);
        })
        .on("mouseout", function (event: MouseEvent, d: FlatDataItem) {
          // Disable hover while selecting area to zoom
          if (disableHoverRef.current) {
            return;
          }

          const mouseOutW = xScaleRef.current(d.timeRange[1]) - xScaleRef.current(d.timeRange[0]);

          d3Select(this)
            .transition()
            .duration(transitionDuration)
            .attr("x", xScaleRef.current(d.timeRange[0]))
            .attr("width", d3Max([MIN_SEGMENT_WIDTH, mouseOutW]) ?? 0)
            .attr("y", (yScaleRef.current(d.groupId) ?? 0) - SEGMENT_HEIGHT / 2)
            .attr("height", SEGMENT_HEIGHT)
            .style("fill-opacity", 1);

          handleSegmentTooltipHide(event.target as HTMLElement);
        });

      timelines = timelines.merge(newSegments);

      timelines
        .attr("rx", (d) => {
          const w = xScale(d.timeRange[1]) - xScale(d.timeRange[0]);
          return getBorderRadius(w);
        })
        .attr("ry", (d) => {
          const w = xScale(d.timeRange[1]) - xScale(d.timeRange[0]);
          return getBorderRadius(w);
        })
        .attr("stroke-width", (d) => {
          const w = xScale(d.timeRange[1]) - xScale(d.timeRange[0]);

          if (w >= 12) {
            return 0.5;
          }

          return 0.1;
        })
        .attr("stroke", "var(--timeline-bg, #ffffff)")
        .attr("height", SEGMENT_HEIGHT);

      timelines
        .transition()
        .duration(animationDuration)
        .attr("x", (d) => xScale(d.timeRange[0]))
        .attr("y", (d) => {
          return (yScale(d.groupId) || 0) - SEGMENT_HEIGHT / 2;
        })
        .attr("width", (d) => {
          const calculated = d3Max([MIN_SEGMENT_WIDTH, (xScale(d.timeRange[1]) ?? 0) - (xScale(d.timeRange[0]) ?? 0)]);
          return (calculated ?? 0) < 0 ? 0 : (calculated ?? 0);
        })
        .attr("height", SEGMENT_HEIGHT)
        .style("fill", (d) =>
          d.hidden ? `url(#gradient-${innerId}-${d.segment.status})` : getColorFromStatus(d.segment.status),
        )
        .style("fill-opacity", 1);
    };

    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, graphW, graphH, graphW, animationDuration, zoomX, xScale, transitionDuration, yScale, innerId]);

  // Update SVG dimensions
  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    d3Select(svgRef.current).transition().duration(animationDuration).attr("width", width).attr("height", height);
  }, [width, height, animationDuration]);

  const handleOverviewChange = useCallback(
    (startTime: Date, endTime: Date) => handleZoomXChange([startTime, endTime]),
    [handleZoomXChange],
  );

  const [min, max] = xScale.range();

  const showBrushes = min !== max;

  if (!showBrushes) {
    return null;
  }

  return (
    <div className={styles.timelineChart}>
      {durationDomain[0] !== durationDomain[1] && showBrushes && (
        <DurationRange
          selectedTestsCount={filteredByDurationSegmentsCount}
          totalTestsCount={flatData.length}
          translations={translations}
          // Reinit the component when the width changes
          key={width}
          width={width}
          height={OVERVIEW_HEIGHT + TOP_MARGIN + BOTTOM_MARGIN}
          margins={{ top: TOP_MARGIN, right: RIGHT_MARGIN, bottom: BOTTOM_MARGIN, left: LEFT_MARGIN }}
          domainRange={durationDomain}
          currentSelection={[minDuration, maxDuration]}
          onChange={handleDurationChange}
          onReset={() => handleDurationChange(durationDomain[0], durationDomain[1])}
          tickFormat={(value) => formatDuration(value)}
        />
      )}
      <svg ref={svgRef} width={width} height={height}>
        <defs>
          {statusesList.map((status) => {
            return (
              <pattern
                key={status}
                id={`gradient-${innerId}-${status}`}
                patternUnits="userSpaceOnUse"
                width="10"
                height="10"
                patternTransform="rotate(-45 5 5)"
              >
                <rect width="5" height="10" fill={getPatternBgFromStatus(status)} />
                <rect x="5" width="5" height="10" fill={getColorFromStatus(status)} />
              </pattern>
            );
          })}
        </defs>
        <g
          ref={axisesRef}
          className={styles.axises}
          data-label="axises"
          transform={`translate(${LEFT_MARGIN},${TOP_MARGIN})`}
        >
          <g ref={xAxisRef} className={styles.xAxis} data-label="x-axis" />
          <g ref={xGridRef} className={styles.xGrid} data-label="grid" />
          <g ref={grpAxisRef} className={styles.groupAxis} data-label="groups-axis" />
        </g>
        <g ref={graphRef} data-label="graph" transform={`translate(${LEFT_MARGIN},${TOP_MARGIN})`}>
          <rect data-label="graph-selection" x={0} y={0} width={graphW} height={graphH} fill="transparent" />
        </g>
      </svg>
      {defaultZoomX[0].getTime() !== defaultZoomX[1].getTime() && showBrushes && (
        <TimeOverview
          width={width}
          height={OVERVIEW_HEIGHT + TOP_MARGIN + BOTTOM_MARGIN}
          margins={{ top: TOP_MARGIN, right: RIGHT_MARGIN, bottom: BOTTOM_MARGIN, left: LEFT_MARGIN }}
          scale={xScale}
          domainRange={defaultZoomX}
          currentSelection={zoomX as [Date, Date]}
          onChange={handleOverviewChange}
          onReset={() => handleZoomXChange(defaultZoomX)}
          tickFormat={(value) => formatDuration(value.getTime() - timeRange[0].getTime())}
        />
      )}
      {createPortal(
        <div ref={groupTooltipRef} data-visible={isGroupTooltipVisible} className={styles.tooltip}>
          <GroupTooltip
            segments={segments}
            groupId={tooltipGroupData.id}
            groupName={tooltipGroupData.name}
            offsetTime={timeRange[0].getTime()}
          />
        </div>,
        document.body,
      )}
      {createPortal(
        <div ref={segmentTooltipRef} data-visible={isSegmentTooltipVisible} className={styles.tooltip}>
          <SegmentTooltip segment={segmentTooltipData} offsetTime={timeRange[0].getTime()} />
        </div>,
        document.body,
      )}
    </div>
  );
};

export const Timeline: FunctionComponent<Omit<TimelineProps, "data"> & { data: TimelineChartData; dataId: string }> = (
  props,
) => {
  const { data: timelineData, width, dataId, ...chartProps } = props;

  const data = useMemo((): TimelineData => {
    return toTimelineData(timelineData, dataId);
  }, [timelineData, dataId]);

  return (
    <div className={styles.timelineContainer}>
      <ResponsiveWrapper defaultWidth={width}>
        <InnerTimeline key={dataId} {...chartProps} data={data} />
      </ResponsiveWrapper>
    </div>
  );
};
