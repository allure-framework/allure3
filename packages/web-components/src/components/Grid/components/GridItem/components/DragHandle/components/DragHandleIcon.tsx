import type { FunctionComponent } from "preact";
import { SvgIcon, allureIcons } from "@/components/SvgIcon";

export interface DragHandleIconProps {
  className?: string;
}

export const DragHandleIcon: FunctionComponent<DragHandleIconProps> = ({ className }) => {
  return <SvgIcon id={allureIcons.draggable} className={className} />;
};
