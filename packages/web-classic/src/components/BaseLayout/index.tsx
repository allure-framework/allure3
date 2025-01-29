import { useEffect } from "preact/hooks";
import SideNav from "@/components/SideNav/SideNav";
import { fetchStats } from "@/stores";
import * as styles from "./styles.scss";

export const BaseLayout = ({ children }) => {
  useEffect(() => {
    fetchStats();
  }, []);
  return (
    <div className={styles.layout}>
      <SideNav />
      {children}
    </div>
  );
};
