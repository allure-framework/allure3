import { SvgIcon, allureIcons } from "@/components/SvgIcon";

export type SpinnerProps = {
  size?: "s" | "m";
};

export const Spinner = ({ size }: SpinnerProps) => {
  return <SvgIcon aria-hidden="true" focusable="false" id={allureIcons.spinner} size={size} />;
};
