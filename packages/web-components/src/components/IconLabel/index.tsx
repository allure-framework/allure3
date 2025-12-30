import cx from "clsx";
import type { FunctionalComponent } from "preact";
import { SvgIcon } from "../SvgIcon";
import { TooltipWrapper } from "../Tooltip";
import { Text } from "../Typography";
import styles from "./styles.scss";

type Props = {
  icon: string;
  tooltip?: string;
  className?: string;
  style?: "primary" | "secondary";
};

export const IconLabel: FunctionalComponent<Props> = (props) => {
  const { icon, children, tooltip, className, style = "secondary", ...rest } = props;

  const content = (
    <div className={cx(styles.wrapper, className)}>
      <SvgIcon className={styles.icon} id={icon} />
      <Text className={styles.text} type="ui" size="s" bold>
        {children}
      </Text>
    </div>
  );

  if (tooltip) {
    return (
      <div className={styles.label} {...rest} data-style={style}>
        <TooltipWrapper tooltipText={tooltip}>{content}</TooltipWrapper>
      </div>
    );
  }

  return (
    <div className={styles.label} {...rest} data-style={style}>
      {content}
    </div>
  );
};

export default IconLabel;
