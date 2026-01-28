import { Loadable } from "@allurereport/web-components";
import { CategoriesTree } from "@/components/Categories/CategoriesTree";
import { useI18n } from "@/stores";
import { categoriesStore } from "@/stores/errorCategories";

export const ReportErrorCategories = () => {
  const { t } = useI18n("empty");

  return (
    <Loadable
      source={categoriesStore}
      renderData={(store) => {
        if (!categoriesStore.value.data?.roots?.length) {
          return <div>{t("no-global-errors-results")}</div>;
        }
        return <CategoriesTree store={store} />;
      }}
    />
  );
};
