import { IconButton, allureIcons } from "@allurereport/web-components";
import { isSplitMode, toggleLayout } from "@/stores/layout";

const ToggleLayout = () => {
  const icon = isSplitMode.value ? allureIcons.lineLayoutsLayoutTop : allureIcons.lineLayoutsColumn2;
  return (
    <IconButton
      data-testId={"toggle-layout-button"}
      size={"s"}
      icon={icon}
      style={"ghost"}
      onClick={() => toggleLayout()}
    />
  );
};

export default ToggleLayout;
