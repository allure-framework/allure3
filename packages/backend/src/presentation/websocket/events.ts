export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface TestResultUploadedEvent extends WebSocketEvent {
  type: 'test-result:uploaded';
  data: {
    testResultId: string;
    launchId: string;
  };
}

export interface TestResultStatusChangedEvent extends WebSocketEvent {
  type: 'test-result:status-changed';
  data: {
    testResultId: string;
    oldStatus: string;
    newStatus: string;
  };
}

export interface LaunchCompletedEvent extends WebSocketEvent {
  type: 'launch:completed';
  data: {
    launchId: string;
    totalTests: number;
  };
}

export interface LaunchCreatedEvent extends WebSocketEvent {
  type: 'launch:created';
  data: {
    launchId: string;
    name: string;
  };
}

export interface WidgetUpdatedEvent extends WebSocketEvent {
  type: 'widget:updated';
  data: {
    widgetName: string;
    launchId?: string;
  };
}

export interface ReportGeneratedEvent extends WebSocketEvent {
  type: 'report:generated';
  data: {
    launchId: string;
    reportUuid: string;
    format: string;
  };
}

export type AllWebSocketEvents =
  | TestResultUploadedEvent
  | TestResultStatusChangedEvent
  | LaunchCompletedEvent
  | LaunchCreatedEvent
  | WidgetUpdatedEvent
  | ReportGeneratedEvent;
