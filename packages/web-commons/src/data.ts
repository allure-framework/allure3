/**
 * Hash which attaches to any report file to prevent caching
 */
export const ALLURE_LIVE_RELOAD_HASH_STORAGE_KEY = "__allure_report_live_reload_hash__";

export const createReportDataScript = (
  reportFiles: {
    name: string;
    value: string;
  }[] = [],
) => {
  if (reportFiles.length === 0) {
    return `
      <script async>
        window.allureReportDataReady = true;
      </script>
    `;
  }

  const reportFilesDeclaration = reportFiles.map(({ name, value }) => `d('${name}','${value}')`).join(",");

  return `
    <script async>
      window.allureReportDataReady = false;
      window.allureReportData = window.allureReportData || {};

      function d(name, value){
        return new Promise(function (resolve) {
          window.allureReportData[name] = value;

          return resolve(true);
        });
      }
    </script>
    <script defer>
      Promise.allSettled([${reportFilesDeclaration}])
        .then(function(){
          window.allureReportDataReady = true;
        })
    </script>
  `;
};

export const ensureReportDataReady = () =>
  new Promise((resolve) => {
    const waitForReady = () => {
      if (globalThis.allureReportDataReady) {
        return resolve(true);
      }

      setTimeout(waitForReady, 30);
    };

    waitForReady();
  });

export const loadReportData = async (name: string): Promise<string> => {
  await ensureReportDataReady();

  return new Promise((resolve, reject) => {
    if (globalThis.allureReportData[name]) {
      return resolve(globalThis.allureReportData[name] as string);
    } else {
      return reject(new Error(`Data "${name}" not found!`));
    }
  });
};

export const reportDataUrl = async (path: string, contentType = "application/octet-stream", cacheSafe = false) => {
  if (globalThis.allureReportData) {
    const [dataKey] = path.split("?");
    const value = await loadReportData(dataKey);

    return `data:${contentType};base64,${value}`;
  }

  const baseEl = globalThis.document.head.querySelector("base")?.href ?? "https://localhost";
  const url = new URL(path, baseEl);
  const liveReloadHash = globalThis.localStorage.getItem(ALLURE_LIVE_RELOAD_HASH_STORAGE_KEY);
  const cacheKey = globalThis.allureReportOptions?.cacheKey;

  if (liveReloadHash) {
    url.searchParams.set("live_reload_hash", liveReloadHash);
  }

  if (cacheSafe && cacheKey) {
    url.searchParams.set("v", cacheKey);
  }

  return url.toString();
};

export const fetchReportJsonData = async <T>(path: string, safeCache = false) => {
  const url = await reportDataUrl(path, undefined, safeCache);
  const res = await globalThis.fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}, response status: ${res.status}`);
  }

  const data = res.json();

  return data as T;
};

export const fetchReportAttachment = async (path: string, contentType?: string) => {
  const url = await reportDataUrl(path, contentType);

  return globalThis.fetch(url);
};

export const getReportOptions = <T>() => {
  return globalThis.allureReportOptions as T;
};
