import * as console from "node:console";
import { type Stats, createReadStream } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { type ServerResponse, createServer } from "node:http";
import { basename, extname, join, resolve } from "node:path";
import { cwd } from "node:process";

import watchDirectory from "@allurereport/directory-watcher";
import openUrl from "open";

import {
  TYPES_BY_EXTENSION,
  identity,
  injectLiveReloadScript,
  normalizeHost,
  resolveServerUrl,
  resolveUrlPathnameUnderServeRoot,
} from "./utils.js";

export type AllureStaticServer = {
  url: string;
  port: number;
  stop: () => Promise<void>;
  reload: () => Promise<void>;
  open: (url: string) => Promise<void>;
};

export const renderDirectory = async (entries: string[], dirPath?: boolean) => {
  const links: string[] = [];
  const files: string[] = [];
  const dirs: string[] = [];

  for (const entry of entries) {
    const stats = await stat(entry);

    if (stats.isDirectory()) {
      dirs.push(entry);
    } else {
      files.push(entry);
    }
  }

  dirs
    .sort((a, b) => a.localeCompare(b))
    .forEach((entry) => {
      links.push(`<a href="./${basename(entry)}/">${basename(entry)}/</a>`);
    });
  files
    .sort((a, b) => a.localeCompare(b))
    .forEach((entry) => {
      links.push(`<a href="./${basename(entry)}">${basename(entry)}</a>`);
    });

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Allure Server</title>
        <meta charset="UTF-8" />
      </head>
      <body>
        <p>Allure Static Server</p>
        <ul>
          ${dirPath ? '<li><a href="../">../</a></li>' : ""}
          ${links.map((link) => `<li>${link}</li>`).join("")}
        </ul>
      </body>
    </html>
  `;
};

/**
 * Starts a static server that serves files from the specified directory
 * To enable live reload, set the `live` option to `true`, then the server will inject a script with a listener to any .html file
 * To open the link immediately in browser, set the `open` option to `true`
 * @example
 * ```ts
 * import { serve } from "@allurereport/static-server";
 *
 * const server = await serve({ port: 3000, host: "127.0.0.1", live: true, servePath: "public" });
 * // trigger reload manually
 * await server.reload();
 *
 * // Stop the server
 * await server.stop();
 * ```
 * @param options
 */
export const serve = async (options?: {
  port?: number;
  /**
   * The host (interface) to bind the server to, e.g. `127.0.0.1` or `0.0.0.0`
   * By default, the server listens on all interfaces
   */
  host?: string;
  live?: boolean;
  servePath?: string;
  open?: boolean;
}): Promise<AllureStaticServer> => {
  const { port, live = false, servePath, open = false } = options ?? {};
  const host = normalizeHost(options?.host);
  const pathToServe = servePath ? resolve(cwd(), servePath) : cwd();
  const clients = new Set<ServerResponse>();
  const server = createServer(async (req, res) => {
    const hostHeaderIdx = req.rawHeaders.findIndex((header) => header === "Host") + 1;
    const host = req.rawHeaders[hostHeaderIdx];
    // TODO: do we need to detect ssl or just http is enough?
    const { pathname, search } = new URL(`http://${host}${req.url!}`);
    const query = new URLSearchParams(search);

    if (pathname === "/__live_reload") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      clients.add(res);

      req.on("close", () => {
        clients.delete(res);
      });
      return;
    }

    const resolvedPublic = resolveUrlPathnameUnderServeRoot(pathToServe, pathname);

    if (resolvedPublic === null) {
      res.writeHead(404);
      return res.end();
    }

    let fsPath = resolvedPublic;
    let stats: Stats;

    try {
      stats = await stat(fsPath);
    } catch (err) {
      // @ts-ignore
      if (err.code === "ENOENT") {
        res.writeHead(404);
      } else {
        res.writeHead(500);
      }

      return res.end();
    }

    // redirect to directory with trailing slash to avoid invalid assets paths issue
    if (stats.isDirectory() && !pathname.endsWith("/")) {
      res.writeHead(301, {
        Location: `${pathname}/`,
      });
      return res.end();
    }

    if (stats.isDirectory()) {
      const files = await readdir(fsPath);

      if (files.includes("index.html")) {
        fsPath = join(fsPath, "index.html");
        stats = await stat(fsPath);
      } else {
        const html = await renderDirectory(
          files.map((file) => resolve(fsPath, file)),
          pathname !== "/",
        );
        const htmlContent = injectLiveReloadScript(html);
        const byteLength = Buffer.byteLength(htmlContent);

        res.writeHead(200, {
          "Content-Type": "text/html",
          "Content-Length": byteLength,
        });

        res.write(htmlContent);
        return res.end();
      }
    }

    const fileExtension = extname(fsPath);
    const contentType = TYPES_BY_EXTENSION[fileExtension] ?? "application/octet-stream";

    // temp fix to prevent live reload script injection to html attachments
    if (contentType === "text/html" && !query.has("attachment")) {
      const html = await readFile(fsPath, "utf-8");
      const htmlContent = injectLiveReloadScript(html);
      const byteLength = Buffer.byteLength(htmlContent);

      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": byteLength,
      });
      res.write(htmlContent);

      return res.end();
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stats.size,
    });

    createReadStream(fsPath)
      .pipe(res)
      .on("close", () => res.end());
  });
  const triggerReload = () => {
    clients.forEach((client) => {
      client.write("data: reload\n\n");
    });
  };
  const serverPort = await new Promise<number>((res, rej) => {
    server.once("error", rej);
    server.listen(port, host, () => {
      server.off("error", rej);

      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("could not start a server: invalid server address is returned");
      }
      res(address.port);
    });
  });

  const unwatch = live
    ? watchDirectory(pathToServe, triggerReload, {
        ignoreInitial: true,
      })
    : identity;

  const serverUrl = resolveServerUrl(host, serverPort);

  console.info(`Allure is running on ${serverUrl}`);

  if (open) {
    openUrl(serverUrl);
  }

  return {
    url: serverUrl,
    port: serverPort,
    // eslint-disable-next-line @typescript-eslint/require-await
    reload: async () => {
      triggerReload();
    },
    open: async (url) => {
      if (url.startsWith("/")) {
        await openUrl(new URL(url, serverUrl).toString());
        return;
      }

      await openUrl(url);
    },
    stop: async () => {
      server.closeAllConnections();
      server.unref();
      await unwatch();
    },
  };
};
