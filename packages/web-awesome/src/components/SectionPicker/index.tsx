import { DropdownButton, Menu, SvgIcon, allureIcons } from "@allurereport/web-components";
import { useI18n } from "@/stores";
import { availableSections, currentSection, setSection } from "@/stores/sections";
import * as styles from "./styles.scss";

export type SectionItem = {
  name: string;
  logo: string;
};

const defaultSection: SectionItem = { name: "report", logo: allureIcons.reportLogo };

const sectionMap: Record<string, SectionItem> = {
  default: defaultSection,
  charts: { name: "charts", logo: allureIcons.lineChartsBarChartSquare },
};

export const SectionPicker = () => {
  const selectedSection = sectionMap[currentSection.value] || defaultSection;
  const { t } = useI18n("sections");

  return (
    <Menu
      size="m"
      placement={"bottom-start"}
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton
          style="ghost"
          size="m"
          text={t(selectedSection.name)}
          icon={selectedSection.logo}
          isExpanded={isOpened}
          onClick={onClick}
          iconSize={"xs"}
        />
      )}
    >
      <Menu.Section>
        {["default", ...availableSections.value].map((value) => (
          <Menu.ItemWithCheckmark
            onClick={() => setSection(value)}
            key={value}
            isChecked={currentSection.value === value}
          >
            <div className={styles["menu-item"]}>
              <SvgIcon id={sectionMap[value]?.logo} size={"s"} />
              {t(sectionMap[value]?.name) || value}
            </div>
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
