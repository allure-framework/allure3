export interface WidgetData {
  [key: string]: any;
}

export interface WidgetResponse {
  name: string;
  type: string;
  data: WidgetData;
}
