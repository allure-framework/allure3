import { Loadable, PageLoader } from "@allurereport/web-components";
import { CategoriesTree } from "@/components/Categories/CategoriesTree";
import { useI18n } from "@/stores";
import { categoriesStore } from "@/stores/categories";
import * as styles from "./styles.scss";

export const ReportCategories = () => {
  const { t } = useI18n("empty");

  return (
    <Loadable
      source={categoriesStore}
      renderLoader={() => (
        <div className={styles["report-categories-loader"]}>
          <PageLoader />
        </div>
      )}
      renderData={(store) => {
        if (!categoriesStore.value.data?.roots?.length) {
          return <div className={styles["report-categories-results-empty"]}>{t("no-categories-results")}</div>;
        }
        return <CategoriesTree store={store} />;
      }}
    />
  );
};
