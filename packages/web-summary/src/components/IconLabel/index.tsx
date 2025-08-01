import { SvgIcon, Text, TooltipWrapper } from "@allurereport/web-components";
import cx from "clsx";
import type { FunctionalComponent } from "preact";
import * as styles from "./styles.scss";

export type IconLabelProps = {
  icon: string;
  tooltip?: string;
  className?: string;
};

export const IconLabel: FunctionalComponent<IconLabelProps> = ({ icon, children, tooltip, className, ...rest }) => {
  const content = (
    <div className={cx(styles["icon-label-wrapper"], className)}>
      <SvgIcon className={styles["icon-label-icon"]} id={icon} />
      <Text className={styles["icon-label-text"]} type="ui" size="s" bold>
        {children}
      </Text>
    </div>
  );

  if (tooltip) {
    return (
      <div className={styles["icon-label"]} {...rest}>
        <TooltipWrapper tooltipText={tooltip}>{content}</TooltipWrapper>
      </div>
    );
  }

  return (
    <div className={styles["icon-label"]} {...rest}>
      {content}
    </div>
  );
};

export default IconLabel;
