import { type LineSvgProps, type Point as OriginalPoint } from "@nivo/line";
import { type Component } from "preact";

declare module "@nivo/line" {
  export interface ResponsiveLine extends Component<LineSvgProps> {}

  interface PointData extends OriginalPoint.data {
    [key: string]: any; // Additional properties that are not defined in the original type, but in fact can be present in the data
  };

  export interface Point extends Omit<OriginalPoint, "data"> {
    data: PointData;
  }
}
