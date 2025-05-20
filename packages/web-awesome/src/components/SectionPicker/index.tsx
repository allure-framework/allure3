import { DropdownButton, Menu, SvgIcon, allureIcons } from "@allurereport/web-components";
import { availableSections, currentSection, setSection } from "@/stores/sections";
import * as styles from "./styles.scss";

export type SectionItem = {
  name: string;
  logo: string;
};
const defaultSection: SectionItem = { name: "Report", logo: allureIcons.reportLogo };

const sectionMap: Record<string, SectionItem> = {
  default: defaultSection,
  charts: { name: "Charts", logo: allureIcons.lineChartsBarChartSquare },
  categories: { name: "Categories", logo: allureIcons.lineAlertsAlertCircle },
};

export const SectionPicker = () => {
  const selectedSection = sectionMap[currentSection.value] || defaultSection;
  return (
    <Menu
      size="m"
      placement={"bottom-start"}
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton
          style="ghost"
          size="m"
          text={selectedSection.name}
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
              {sectionMap[value]?.name || value}
            </div>
          </Menu.ItemWithCheckmark>
        ))}
      </Menu.Section>
    </Menu>
  );
};
