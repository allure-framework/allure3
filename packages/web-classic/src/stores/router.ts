import { computed, signal } from "@preact/signals";

type NavigateToString = string;
type NavigateToObject = {
  tabName?: string;
  params?: {
    id?: string | null;
    testResultId?: string | null;
  };
};

const parseHash = () => {
  const hash = globalThis.location.hash.slice(1);
  const [tabName, ...params] = hash.split("/");
  const result = {
    tabName: tabName || "overview",
    params: { id: params[0] || null, testResultId: params[1] || null },
  };
  /* #region agent log */
  if (typeof fetch !== "undefined") {
    const payload = { sessionId: "f7a19b", location: "router.ts:parseHash", message: "parseHash result", data: { hash, parsedTabName: tabName, resultTabName: result.tabName }, timestamp: Date.now(), hypothesisId: "A", runId: "post-fix" };
    fetch("http://127.0.0.1:7769/ingest/a8122316-6c42-40f6-b56b-8ed62be2f997", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "f7a19b" }, body: JSON.stringify(payload) }).catch(() => {});
  }
  /* #endregion */
  return result;
};

export const route = signal(parseHash());

export const handleHashChange = () => {
  const newRoute = parseHash();

  if (
    newRoute.tabName !== route.value.tabName ||
    newRoute.params.id !== route.value.params.id ||
    newRoute.params.testResultId !== route.value.params.testResultId
  ) {
    route.value = newRoute;
  }
};

export const navigateTo = (path: NavigateToString | NavigateToObject) => {
  let newHash = "";

  if (typeof path === "string") {
    newHash = path.startsWith("#") ? path.slice(1) : path;
  } else {
    const { tabName = "overview", params = {} } = path;
    const { id = null, testResultId = null } = params;
    newHash = `${tabName}/${id || ""}/${testResultId || ""}`;
  }

  history.pushState(null, "", `#${newHash}`);

  handleHashChange();
};

export const openInNewTab = (path: string) => {
  window.open(`#${path}`, "_blank");
};

export const activeTab = computed(() => route.value.tabName);
