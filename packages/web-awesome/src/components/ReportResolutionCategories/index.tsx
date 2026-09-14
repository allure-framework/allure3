import { Loadable, PageLoader } from "@allurereport/web-components";

import { ResolutionCategoriesList } from "@/components/ResolutionCategoriesList";
import { useI18n } from "@/stores";
import { resolutionCategoriesStore } from "@/stores/resolutionCategories";

import * as styles from "./styles.scss";

export const ReportResolutionCategories = () => {
  const { t } = useI18n("empty");

  return (
    <Loadable
      source={resolutionCategoriesStore}
      renderLoader={() => (
        <div className={styles["report-resolution-categories-loader"]}>
          <PageLoader />
        </div>
      )}
      renderData={(resolutionCategories) => (
        <ResolutionCategoriesList
          groups={resolutionCategories?.groups ?? []}
          showTests
          emptyText={t("no-resolution-categories-results")}
        />
      )}
    />
  );
};
