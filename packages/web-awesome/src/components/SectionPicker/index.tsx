import { DropdownButton, Menu, SvgIcon, allureIcons } from "@allurereport/web-components";
import { computed } from "@preact/signals";
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
  timeline: { name: "timeline", logo: allureIcons.lineChartsTimeline },
};

const selectedSection = computed(() => sectionMap[currentSection.value] || defaultSection);

export const SectionPicker = () => {
  const { t } = useI18n("sections");

  return (
    <Menu
      size="m"
      placement={"bottom-start"}
      menuTrigger={({ isOpened, onClick }) => (
        <DropdownButton
          style="ghost"
          size="m"
          text={t(selectedSection.value.name)}
          icon={selectedSection.value.logo}
          isExpanded={isOpened}
          onClick={onClick}
          iconSize={"xs"}
        />
      )}
    >
      <Menu.Section>
        {["default", ...availableSections].map((value) => (
          <Menu.ItemWithCheckmark
            onClick={() => setSection(value as any)}
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
