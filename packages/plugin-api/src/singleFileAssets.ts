import { gzipSync } from "node:zlib";

import { stringifyForInlineScript } from "@allurereport/core-api";

const embeddedAssetsElementId = "allure-single-file-assets";

export const createSingleFileScripts = (
  files: ReadonlyMap<string, Buffer>,
  mainJs: string,
  { compress = true }: { compress?: boolean } = {},
): string => {
  const encodedScripts = Object.fromEntries(
    [...files]
      .filter(([fileName]) => fileName.endsWith(".js"))
      .map(([fileName, content]) => [
        fileName,
        (compress ? gzipSync(content, { level: 9 }) : content).toString("base64"),
      ]),
  );

  const licenses = Object.fromEntries(
    [...files]
      .filter(([fileName]) => fileName.endsWith(".LICENSE.txt"))
      .map(([fileName, content]) => [fileName, content.toString("utf8")]),
  );

  if (!encodedScripts[mainJs]) {
    throw new Error(`The report static assets do not contain the main script: ${mainJs}`);
  }

  return `
    <script id="allure-single-file-licenses" type="application/json">${stringifyForInlineScript(licenses)}</script>
    <script id="${embeddedAssetsElementId}" type="application/json">${stringifyForInlineScript(encodedScripts)}</script>
    <script>
      (function () {
        const assetsElement = document.getElementById(${stringifyForInlineScript(embeddedAssetsElementId)});
        const assets = JSON.parse(assetsElement.textContent || "{}");
        const appendChild = document.head.appendChild;

        assetsElement.remove();

        function embeddedAssetName(script) {
          const source = script.getAttribute("src");

          if (!source) {
            return undefined;
          }

          const path = source.split(/[?#]/, 1)[0];

          return path.slice(path.lastIndexOf("/") + 1);
        }

        async function decodeAsset(encoded) {
          const binary = atob(encoded);
          const bytes = new Uint8Array(binary.length);

          for (let index = 0; index < binary.length; index++) {
            bytes[index] = binary.charCodeAt(index);
          }

          ${
            compress
              ? `const stream = new Response(bytes).body.pipeThrough(new DecompressionStream("gzip"));
          return new Response(stream).text();`
              : "return new Response(bytes).text();"
          }
        }

        document.head.appendChild = function (node) {
          if (node.tagName !== "SCRIPT") {
            return appendChild.call(this, node);
          }

          const fileName = embeddedAssetName(node);
          const encoded = fileName && Object.hasOwn(assets, fileName) ? assets[fileName] : undefined;

          if (!encoded) {
            return appendChild.call(this, node);
          }

          void decodeAsset(encoded)
            .then(function (source) {
              node.removeAttribute("src");
              node.text = source;
              delete assets[fileName];
              appendChild.call(document.head, node);
              node.dispatchEvent(new Event("load"));
            })
            .catch(function (error) {
              console.error("Failed to load embedded report asset " + fileName, error);
              node.dispatchEvent(new Event("error"));
            });

          return node;
        };

        const mainScript = document.createElement("script");

        mainScript.src = ${stringifyForInlineScript(mainJs)};
        document.head.appendChild(mainScript);
      })();
    </script>
  `;
};
