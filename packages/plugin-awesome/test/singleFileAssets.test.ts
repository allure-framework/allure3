import { runInNewContext } from "node:vm";
import { gunzipSync } from "node:zlib";

import { epic, feature, label, story } from "allure-js-commons";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSingleFileScripts } from "../src/singleFileAssets.js";

beforeEach(async () => {
  await epic("coverage");
  await feature("plugin-awesome");
  await story("single-file-static-assets");
  await label("coverage", "plugin-awesome");
});

const extractAssets = (html: string): Record<string, string> => {
  const match = html.match(/<script id="allure-single-file-assets" type="application\/json">([^<]+)<\/script>/i);

  expect(match, "embedded static assets must be present").not.toBeNull();

  return JSON.parse(match![1]);
};

describe("createSingleFileScripts", () => {
  it("embeds gzip-compressed JavaScript assets and starts the main script", () => {
    const files = new Map([
      ["app.js", Buffer.from("globalThis.appLoaded = true;")],
      ["mermaid.js", Buffer.from("globalThis.mermaidLoaded = true;")],
      ["app.css", Buffer.from("body { color: purple; }")],
    ]);

    const html = createSingleFileScripts(files, "app.js");
    const assets = extractAssets(html);

    expect(Object.keys(assets)).toEqual(["app.js", "mermaid.js"]);
    expect(gunzipSync(Buffer.from(assets["app.js"], "base64"))).toEqual(files.get("app.js"));
    expect(gunzipSync(Buffer.from(assets["mermaid.js"], "base64"))).toEqual(files.get("mermaid.js"));
    expect(html).toContain('mainScript.src = "app.js"');
    expect(html).toContain('new DecompressionStream("gzip")');
  });

  it("decompresses the main script immediately and a runtime chunk only when requested", async () => {
    const files = new Map([
      ["app.js", Buffer.from("globalThis.appLoaded = true;")],
      ["mermaid.js", Buffer.from("globalThis.mermaidLoaded = true;")],
    ]);
    const html = createSingleFileScripts(files, "app.js");
    const bootstrapMatch = html.match(/<script>\s*([\s\S]+)\s*<\/script>/i);
    const appendedScripts: FakeScript[] = [];
    const assetsElement = {
      textContent: JSON.stringify(extractAssets(html)),
      remove: vi.fn(),
    };

    class FakeScript extends EventTarget {
      readonly tagName = "SCRIPT";
      readonly attributes = new Map<string, string>();

      get src() {
        return this.attributes.get("src") ?? "";
      }

      set src(value: string) {
        this.attributes.set("src", value);
      }

      getAttribute(name: string) {
        return this.attributes.get(name) ?? null;
      }

      removeAttribute(name: string) {
        this.attributes.delete(name);
      }

      text = "";
    }

    const head = {
      appendChild: (node: FakeScript) => {
        appendedScripts.push(node);
        return node;
      },
    };
    const document = {
      head,
      getElementById: () => assetsElement,
      createElement: () => new FakeScript(),
    };

    runInNewContext(bootstrapMatch?.[1] ?? "", {
      Blob,
      DecompressionStream,
      Event,
      Object,
      Response,
      Uint8Array,
      atob,
      console,
      document,
    });

    await vi.waitFor(() => expect(appendedScripts).toHaveLength(1));

    const mainScript = appendedScripts[0];

    expect(mainScript.src).toBe("");
    expect(mainScript.text).toBe(files.get("app.js")?.toString());
    expect(assetsElement.remove).toHaveBeenCalledOnce();

    mainScript.dispatchEvent(new Event("load"));

    const mermaidScript = new FakeScript();

    mermaidScript.src = "mermaid.js";
    document.head.appendChild(mermaidScript);

    await vi.waitFor(() => expect(appendedScripts).toHaveLength(2));
    expect(mermaidScript.src).toBe("");
    expect(mermaidScript.text).toBe(files.get("mermaid.js")?.toString());

    mermaidScript.dispatchEvent(new Event("load"));
  });

  it("rejects a missing main script", () => {
    expect(() => createSingleFileScripts(new Map([["chunk.js", Buffer.from("chunk")]]), "app.js")).toThrow(
      "do not contain the main script: app.js",
    );
  });
});
