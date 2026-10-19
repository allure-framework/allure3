import type { SubtreeToggleAction } from "@allurereport/web-commons";
import { IconButton, TooltipWrapper } from "@allurereport/web-components/core";
import type { FunctionalComponent } from "preact";

import { useI18n } from "@/stores/locale";

const labelKeyByAction = {
  "expand-first-level": "expandFirstLevel",
  "collapse-to-first-level": "collapseToFirstLevel",
  "expand-all": "expandAll",
  "collapse-all": "collapseAll",
} as const satisfies Record<SubtreeToggleAction, string>;

type SubtreeToggleButtonProps = {
  /**
   * What the next click does, it is shown in the tooltip
   */
  "action": SubtreeToggleAction;
  "icon": string;
  "onClick": (event: MouseEvent) => void;
  "className"?: string;
  "wrapperClassName"?: string;
  "data-testid"?: string;
};

export const SubtreeToggleButton: FunctionalComponent<SubtreeToggleButtonProps> = ({
  action,
  icon,
  onClick,
  className,
  wrapperClassName,
  "data-testid": dataTestId,
}) => {
  const { t } = useI18n("controls");
  const label = t(labelKeyByAction[action]);

  return (
    <TooltipWrapper tooltipText={label} className={wrapperClassName}>
      <IconButton
        style="ghost"
        size="xs"
        icon={icon}
        aria-label={label}
        onClick={onClick}
        data-testid={dataTestId}
        className={className}
      />
    </TooltipWrapper>
  );
};
