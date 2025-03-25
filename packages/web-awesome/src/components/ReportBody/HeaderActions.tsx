import { Button, DropdownButton, Menu, SearchBox, allureIcons } from "@allurereport/web-components";
import { useI18n } from "@/stores/locale";
import { setTreeQuery, treeQuery } from "@/stores/treeFilters";
import { Filters } from "./Filters";
import * as styles from "./styles.scss";

const Search = () => {
  const { t } = useI18n("search");
  const query = treeQuery.value;

  return <SearchBox placeholder={t("search-placeholder")} value={query} onChange={setTreeQuery} />;
};

const TreeToggler = () => {
  const { t } = useI18n("ui");

  const handleSelect = (selectedOption: any) => {
    // setLocale(selectedOption);
  };
  const treeOptions = [
    { key: "Suites", value: "ekke" },
    { key: "Categories", value: "ekke" },
  ];

  return (
    <Menu
      size="s"
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton style="outline" size="m" text={"Categories"} isExpanded={isOpened} onClick={onClick} />
      )}
    >
      <Menu.Section>
        {treeOptions.map(({ key, value }) => (
          <Menu.ItemWithCheckmark onClick={() => handleSelect(key)} key={key} isChecked={true}>
            {value}
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};

export const HeaderActions = () => {
  return (
    <div className={styles.headerActions}>
      <TreeToggler />
      <Search />
      <Filters />
    </div>
  );
};
