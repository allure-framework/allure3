import spinnerIcon from "@/assets/svg/spinner.svg";
import { SvgIcon } from "../SvgIcon";

export const Spinner = (props: { size?: "s" | "m" }) => {
  const { size } = props;

  return <SvgIcon role="progressbar" id={spinnerIcon.id} size={size} />;
};
