import { clsx } from "clsx";
import type { JSX } from "preact";
import * as styles from "./styles.scss";

export type SvgIconProps = Omit<JSX.HTMLAttributes<SVGElement>, "className" | "id" | "size" | "inline"> & {
  /**
   * "xs" is 12x12
   * "s" is 16x16
   * "m" size is 20x20
   *
   * @default s
   */
  size?: "xs" | "s" | "m";
  /**
   * Additional class name
   */
  className?: string;
  /**
   * Icon id
   *
   * @example
   * import lineShapesMoonIcon from "@/components/assets/svg/line-shapes-moon.svg";
   *
   * <SvgIcon id={lineShapesMoonIcon.id} />
   */
  id: string;
  /**
   * Inline icon
   */
  inline?: boolean;
};

/**
 * Renders SVG icon
 *
 * default size is 16x16
 */
export const SvgIcon = (props: SvgIconProps) => {
  const { id, size = "s", inline = false, className = "" } = props;

  return (
    <svg className={clsx(styles.icon, styles[`size-${size}`], inline && styles.inline, className)}>
      <use xlinkHref={`#${id}`} />
    </svg>
  );
};
