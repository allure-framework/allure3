import { BaseLayout } from "@/components/BaseLayout";
import { SplitLayout } from "@/components/SplitLayout";
import { isSplitMode } from "@/stores/layout";

export const Report = () => {
  return isSplitMode.value ? <SplitLayout /> : <BaseLayout />;
};
