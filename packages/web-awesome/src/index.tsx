import { render } from "preact";
import "preact/debug";
import { useEffect, useState } from "preact/hooks";
import "@/assets/scss/index.scss";
import { BaseLayout } from "@/components/BaseLayout";
import { isMac } from "@/utils/isMac";

const App = () => {
  const [testResultId, setTestResultId] = useState<string>("");

  const getLocationHashId = () => {
    const hash = globalThis.location.hash;
    const match = hash.match(/[^#/]+$/);
    return match ? match[0] : null;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const id = getLocationHashId();
      setTestResultId(id);
    };

    handleHashChange();
    globalThis.addEventListener("hashchange", handleHashChange);

    return () => {
      globalThis.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return <BaseLayout testResultId={testResultId} />;
};

export const navigateTo = (path: string) => {
  globalThis.location.hash = path;
};

export const openInNewTab = (path: string) => {
  window.open(`#${path}`, "_blank");
};

const rootElement = document.getElementById("app");

document.addEventListener("DOMContentLoaded", () => {
  if (isMac) {
    document.documentElement.setAttribute("data-os", "mac");
  }
});

(async () => {
  render(<App />, rootElement);
})();
