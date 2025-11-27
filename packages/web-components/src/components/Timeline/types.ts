import type { TestResult } from "@allurereport/core-api";

export type TimelineSegment = {
  timeRange: [Date, Date];
  val: number;
  status: "failed" | "broken" | "passed" | "skipped" | "unknown";
  label: string;
  id: string;
};

export type TimelineDataGroup = {
  id: string;
  name: string;
  segments: TimelineSegment[];
};

export type TimelineData = TimelineDataGroup[];

export type FlatDataItem = {
  groupId: string;
  groupName: string;
  label: string;
  id: string;
  timeRange: [Date, Date];
  val: number;
  labelVal: number;
  segment: TimelineSegment;
};

export type TimelineChartData = TestResult[];
