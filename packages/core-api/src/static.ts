export const createScriptTag = (src: string, options?: { async?: false; defer?: false }) => {
  return `<script ${options?.async ? "async" : ""} ${options?.defer ? "defer" : ""} src="${src}"></script>`;
};

export const createStylesLinkTag = (src: string) => {
  return `<link rel="stylesheet" type="text/css" href="${src}">`;
};

export const createFontLinkTag = (src: string) => {
  return `<link rel="preload" href="${src}" as="font" type="font/woff" crossorigin /> `;
};

export const createFaviconLinkTag = (src: string) => {
  return `<link rel="icon" href="${src}">`;
};

export const createBaseUrlScript = () => {
  return `
    <script>
      const { origin, pathname } = window.location;
      const url = new URL(pathname, origin);
      const baseEl = document.createElement("base");

      baseEl.href = url.toString();

      window.document.head.appendChild(baseEl);
    </script>
  `;
};

/**
 * Same as JSON.stringify, but escapes < > & \u2028 \u2029
 */
export const stringifyForInlineScript = (value: unknown): string => {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003C")
    .replaceAll(">", "\\u003E")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
};

export const createReportDataScript = (
  reportFiles: {
    name: string;
    value: string;
  }[] = [],
) => {
  if (!reportFiles?.length) {
    return `
      <script async>
        window.allureReportDataReady = true;
      </script>
    `;
  }

  const reportFilesDeclaration = reportFiles
    .map(({ name, value }) => `d(${JSON.stringify(name)},${JSON.stringify(value)})`)
    .join(",");

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
