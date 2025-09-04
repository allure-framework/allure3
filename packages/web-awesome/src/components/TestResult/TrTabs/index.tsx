import { type ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { NavTab, NavTabs, NavTabsList, useNavTabsContext } from "@/components/NavTabs";
import { activeSubTab, navigateTo, route } from "@/stores/router";

export const TrTabs = NavTabs;
export const TrTabsList = NavTabsList;
export const useTestResultTabsContext = useNavTabsContext;

export const TrTab = (props: { id: string; children: ComponentChildren }) => {
  const { testResultId } = route.value.params;
  const { currentTab, setCurrentTab } = useNavTabsContext();
  const { id, children } = props;
  const isActiveFromUrl = activeSubTab.value === id;
  const handleTabClick = () => {
    const isCurrentTab = isActiveFromUrl ? isActiveFromUrl : currentTab === id;
    if (isCurrentTab) {
      return;
    }
    setCurrentTab(id);
    navigateTo({
      ...route.value,
      params: {
        testResultId,
        subTab: id || null,
      },
    });
  };
  const isCurrentTab = isActiveFromUrl ? isActiveFromUrl : currentTab === id;

  useEffect(() => {
    if (isActiveFromUrl) {
      setCurrentTab(id);
    }
  }, [activeSubTab.value, id, setCurrentTab]);

  return (
    <NavTab id={id} onClick={handleTabClick} data-testid={`test-result-tab-${id}`} isCurrentTab={isCurrentTab}>
      {children}
    </NavTab>
  );
};
