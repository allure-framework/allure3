import spinnerIcon from "@/assets/svg/spinner.svg";
import { SvgIcon } from "@/components/SvgIcon";

export type SpinnerProps = {
  size?: "s" | "m";
};

export const Spinner = ({ size }: SpinnerProps) => {
  return <SvgIcon role="progressbar" id={spinnerIcon.id} size={size} />;
};
