import SideNav from "@/components/SideNav/SideNav";
import * as styles from "./styles.scss";

export const BaseLayout = ({ children }) => {
  return (
    <div className={styles.layout}>
      <SideNav />
      {children}
    </div>
  );
};
