import { IconButton, TooltipWrapper, allureIcons } from "@allurereport/web-components";

import { useI18n } from "@/stores/locale";
import {
  allTreesCollapsed,
  allTreesExpanded,
  canResetTreesToDefault,
  hasCollapsibleTrees,
  resetTreesToDefault,
  setAllTreesOpened,
} from "@/stores/tree";

export const CollapseAll = () => {
  const { t } = useI18n("controls");

  if (!hasCollapsibleTrees.value) {
    return null;
  }

  const isCollapsed = allTreesCollapsed.value;
  const shouldReset = !isCollapsed && allTreesExpanded.value && canResetTreesToDefault.value;
  // The button goes through the states: the default view -> every group is collapsed -> every group is expanded ->
  // the default view. A partially expanded view (the default one or the one made by hand) is collapsed.
  let label = t("collapseAllPartial");

  if (isCollapsed) {
    label = t("expandAll");
  } else if (shouldReset) {
    label = t("collapseToDefault");
  } else if (allTreesExpanded.value) {
    label = t("collapseAll");
  }

  const icon = isCollapsed ? allureIcons.lineArrowsChevronDownDouble : allureIcons.lineArrowsChevronUpDouble;
  const handleClick = () => {
    if (shouldReset) {
      resetTreesToDefault();
      return;
    }

    setAllTreesOpened(isCollapsed);
  };

  return (
    <TooltipWrapper tooltipText={label}>
      <IconButton
        data-testid="collapse-all-button"
        aria-label={label}
        size="s"
        style="ghost"
        icon={icon}
        onClick={handleClick}
      />
    </TooltipWrapper>
  );
};
