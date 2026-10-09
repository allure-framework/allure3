import { gzipSync } from "node:zlib";

import { stringifyForInlineScript } from "@allurereport/core-api";

const embeddedAssetsElementId = "allure-single-file-assets";

export const createSingleFileScripts = (files: ReadonlyMap<string, Buffer>, mainJs: string): string => {
  const compressedScripts = Object.fromEntries(
    [...files]
      .filter(([fileName]) => fileName.endsWith(".js"))
      .map(([fileName, content]) => [fileName, gzipSync(content, { level: 9 }).toString("base64")]),
  );

  if (!compressedScripts[mainJs]) {
    throw new Error(`The report static assets do not contain the main script: ${mainJs}`);
  }

  return `
    <script id="${embeddedAssetsElementId}" type="application/json">${stringifyForInlineScript(compressedScripts)}</script>
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

        async function decompressAsset(encoded) {
          const binary = atob(encoded);
          const compressed = new Uint8Array(binary.length);

          for (let index = 0; index < binary.length; index++) {
            compressed[index] = binary.charCodeAt(index);
          }

          const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));

          return new Response(stream).text();
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

          void decompressAsset(encoded)
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
