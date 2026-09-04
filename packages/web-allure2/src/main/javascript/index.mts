import { App } from "./app/index.mts";
import "./features/shell/index.mts";
import faviconUrl from "./favicon.ico";

import "./shared/styles/primitives/arrow/styles.scss";
import "./shared/styles/primitives/executor-icon/styles.scss";
import "./shared/styles/primitives/status-details/styles.scss";
import "./shared/styles/primitives/table/styles.scss";
import "./shared/styles/primitives/tabs/styles.scss";
import "./shared/styles/primitives/pane/styles.scss";

document.addEventListener("DOMContentLoaded", () => {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]') ?? document.createElement("link");

  favicon.rel = "icon";
  favicon.href = faviconUrl;

  if (!favicon.isConnected) {
    document.head.append(favicon);
  }

  App.start();
});
