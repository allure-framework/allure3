import type { TestResult } from "@allurereport/core-api";

export type TimlineTr = Pick<
  TestResult,
  "id" | "name" | "status" | "flaky" | "hidden" | "environment" | "start" | "duration" | "historyId"
> & {
  host: string;
  thread: string;
};

export type TimelineSegment = {
  timeRange: [Date, Date];
  val: number;
  status: "failed" | "broken" | "passed" | "skipped" | "unknown";
  hidden?: boolean;
  label: string;
  labelGroup: string[]; // used to group segments by labels
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
  labelGroup: string[]; // used to group segments by labels
  id: string;
  timeRange: [Date, Date];
  hidden?: boolean;
  val: number;
  labelVal: number;
  segment: TimelineSegment;
};

export type TimelineChartData = TimlineTr[];
