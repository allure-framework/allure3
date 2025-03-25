import { DropdownButton, Menu } from "@allurereport/web-components";
import { useI18n } from "@/stores";
import type { TreeSwitcher } from "@/stores/treeSwitcher";
import { currentTree, setCurrentTree } from "@/stores/treeSwitcher";

export const TreeToggle = () => {
  const { t } = useI18n("ui");

  const handleSelect = (selectedOption: TreeSwitcher) => {
    setCurrentTree(selectedOption);
  };
  const treeOptions: Record<TreeSwitcher, string> = {
    suites: t("suites"),
    categories: t("categories"),
  };

  return (
    <Menu
      size="s"
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton
          style="outline"
          size="m"
          text={treeOptions[currentTree.value]}
          isExpanded={isOpened}
          onClick={onClick}
        />
      )}
    >
      <Menu.Section>
        {Object.entries(treeOptions).map(([key, value]) => (
          <Menu.ItemWithCheckmark
            onClick={() => handleSelect(key as TreeSwitcher)}
            key={key}
            isChecked={currentTree.value === value}
          >
            {value}
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
