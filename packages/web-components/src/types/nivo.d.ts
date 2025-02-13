import { type LineSvgProps } from "@nivo/line";
import { type Component } from "preact";

declare module "@nivo/line" {
  export interface ResponsiveLine extends Component<LineSvgProps> {}
}
