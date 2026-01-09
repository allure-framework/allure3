import { navigateTo } from "@allurereport/web-commons";
import { type ComponentChildren } from "preact";
import { NavTab, NavTabs, NavTabsList } from "@/components/NavTabs";
import { testResultIdStore, trTabStore } from "@/stores/testResult";

export const TrTabs = NavTabs;
export const TrTabsList = NavTabsList;

export const TrTab = (props: { id: string; children: ComponentChildren }) => {
  const testResultId = testResultIdStore.value;
  const currentTab = trTabStore.value;

  const { id, children } = props;

  const isCurrentTab = currentTab === id;

  const handleTabClick = () => {
    if (isCurrentTab) {
      return;
    }

    navigateTo({
      path: `${testResultId}/${id}`,
    });
  };

  return (
    <NavTab id={id} onClick={handleTabClick} data-testid={`test-result-tab-${id}`} isCurrentTab={isCurrentTab}>
      {children}
    </NavTab>
  );
};
