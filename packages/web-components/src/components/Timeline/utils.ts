import { type Axis, axisBottom, axisLeft, axisTop } from "d3-axis";
import { useEffect, useRef, useState } from "preact/hooks";
import type { TimelineChartData, TimelineData } from "./types";

export const stringToNanoIdWithSalt = (input: string, salt: string): string => {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-";
  const len = 21;

  // Simple djb2 hash mixing input and salt; not for security, just for collision-resistance
  let hash = 5381;
  const strArr = Array.from(`${input}:${salt}`);
  // Using for-of loop as recommended by linter for simple iteration
  for (const char of strArr) {
    // djb2 mixing, using bitwise operations to encourage hash dispersion (not for cryptographic security)
    hash = Math.imul(hash, 33) + char.charCodeAt(0);
  }

  // Produce ID of length `len` from hash
  const idArr = new Array(len);
  let seed = Math.abs(hash);
  for (let i = 0; i < len; ++i) {
    seed = (seed * 1664525 + 1013904223) % 4294967296; // Linear congruential generator
    idArr[i] = alphabet[seed % alphabet.length];
  }

  return idArr.join("");
};

type ZoomEventProps = {
  zoomX: [Date | null, Date | null] | null;
  zoomY: [number | null, number | null] | null;
  redraw?: boolean;
};

export class ZoomEvent extends CustomEvent<ZoomEventProps> {
  constructor(props: ZoomEventProps) {
    super("zoom", {
      detail: props,
    });
  }
}

export const d3AxisBottom = <T>(): Axis<T> => {
  // @ts-expect-error axis functions can be called without scale initially
  return axisBottom();
};

export const d3AxisTop = <T>(): Axis<T> => {
  // @ts-expect-error axis functions can be called without scale initially
  return axisTop();
};

export const d3AxisLeft = <T>(): Axis<T> => {
  // @ts-expect-error axis functions can be called without scale initially
  return axisLeft();
};

export type ZoomX =
  | readonly [Date, Date]
  | readonly [Date, null]
  | readonly [null, Date]
  | readonly [null, null]
  | null;
export type ZoomY =
  | readonly [number, number]
  | readonly [number, null]
  | readonly [null, number]
  | readonly [null, null]
  | null;

export const isZoomNull = (zoom: ZoomX | ZoomY) => {
  return zoom == null || (zoom[0] == null && zoom[1] == null);
};

export const isZoomXEqual = (zoomA: ZoomX, zoomB: ZoomX) => {
  // If both are null
  if (!zoomA && !zoomB) {
    return true;
  }

  // some are null
  if (!zoomA && zoomB) {
    return false;
  }
  if (zoomA && !zoomB) {
    return false;
  }

  const zoomA0 = zoomA?.[0]?.getTime() ?? undefined;
  const zoomA1 = zoomA?.[1]?.getTime() ?? undefined;
  const zoomB0 = zoomB?.[0]?.getTime() ?? undefined;
  const zoomB1 = zoomB?.[1]?.getTime() ?? undefined;

  return zoomA0 === zoomB0 && zoomA1 === zoomB1;
};

export const isZoomYEqual = (zoomA: ZoomY, zoomB: ZoomY) => {
  // Both are null
  if (!zoomA && !zoomB) {
    return true;
  }

  // some are null
  if (!zoomA && zoomB) {
    return false;
  }
  if (zoomA && !zoomB) {
    return false;
  }

  const zoomA0 = zoomA?.[0] ?? undefined;
  const zoomA1 = zoomA?.[1] ?? undefined;
  const zoomB0 = zoomB?.[0] ?? undefined;
  const zoomB1 = zoomB?.[1] ?? undefined;

  return zoomA0 === zoomB0 && zoomA1 === zoomB1;
};

/**
 * Exports state value to ref to use in closures
 */
export const useStateRef = <T>(initialValue: T | (() => T), onRefChange: (ref: T) => void = noop) => {
  const [value, setValue] = useState<T>(initialValue);
  const ref = useRef<T>(value);
  const onRefChangeRef = useRef(onRefChange);

  useEffect(() => {
    onRefChangeRef.current = onRefChange;
  }, [onRefChange]);

  useEffect(() => {
    ref.current = value;
    onRefChangeRef.current(ref.current);
  }, [value]);

  return [ref, value, setValue] as const;
};

export const noop = () => {};

export const toTimelineData = (timelineData: TimelineChartData, dataId: string): TimelineData => {
  const groups: TimelineData = [];

  for (const test of timelineData) {
    const { host, thread, historyId, id: testId, start, duration, status, hidden, name } = test;
    const stop = start! + duration!;

    const hostId = stringToNanoIdWithSalt(host, dataId);
    const groupId = stringToNanoIdWithSalt(thread, hostId);
    const group = groups.find(({ id }) => id === groupId);
    const newSegments = group?.segments ?? [];

    const segmentId = historyId ?? testId;
    const hasSegment = newSegments.findIndex(({ id }) => id === segmentId) !== -1;
    const segmentWithSameTimeRange = newSegments.find(
      ({ timeRange }) => timeRange[0].getTime() === start && timeRange[1].getTime() === stop,
    );

    if (!hasSegment && !segmentWithSameTimeRange) {
      newSegments.push({
        label: name,
        labelGroup: [name],
        timeRange: [new Date(start as number), new Date(stop as number)],
        val: duration!,
        status: status,
        id: segmentId,
        hidden: hidden,
      });
    }

    if (!hasSegment && segmentWithSameTimeRange) {
      segmentWithSameTimeRange.labelGroup.push(test.name);
    }

    if (group) {
      group.segments = newSegments;
    } else {
      groups.push({
        id: groupId,
        name: thread,
        segments: newSegments,
      });
    }
  }

  return groups;
};

export const minPositive = (value: number | undefined) => {
  if (!value) {
    return 0;
  }

  return value < 0 ? 0 : value;
};
