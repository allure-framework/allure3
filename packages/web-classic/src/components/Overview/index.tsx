import { Loadable, PageLoader, Grid } from "@allurereport/web-components";
import * as styles from "@/components/BaseLayout/styles.scss";
import { testResultStore } from "@/stores/testResults";
import { treeStore } from "@/stores/tree";

const Overview = () => {
  return (
    <Loadable
      source={treeStore}
      renderLoader={() => <PageLoader />}
      renderData={(data) => {
        console.log(data);

        return (<Grid><div key={1}>Widget</div><div key={2}>Widget2</div></Grid>);
      }}
    />
  );
};
export default Overview;
