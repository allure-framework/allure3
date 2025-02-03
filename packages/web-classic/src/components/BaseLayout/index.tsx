import { useEffect } from "preact/hooks";
import Modal from "@/components/Modal";
import SideNav from "@/components/SideNav/SideNav";
import { fetchStats } from "@/stores";
import { route } from "@/stores/router";
import { testResultStore } from "@/stores/testResults";
import * as styles from "./styles.scss";

export const BaseLayout = ({ children }) => {
  const { testResultId } = route.value.params;
  const testResult = testResultStore.value;

  useEffect(() => {
    fetchStats();
  }, []);
  return (
    <div className={styles.layout}>
      <SideNav />
      {children}
      <Modal testResult={testResult.data?.[testResultId]} />
    </div>
  );
};
