#!/usr/bin/env node
/**
 * Serves report-app build + web-awesome assets, proxies /api/ to backend.
 * Runs on host so it can reach localhost:3000 (avoids Docker networking issues).
 */
import { createServer, request } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const STATIC_DIR = join(ROOT, "dist");
const WEB_AWESOME_DIR = join(ROOT, "..", "web-awesome", "dist", "multi");
const API_BACKEND = "http://127.0.0.1:3000";
const PORT = 8080;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".map": "application/json",
  ".css": "text/css",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function serveFile(res, filePath, contentType) {
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) return false;
    res.writeHead(200, { "Content-Type": contentType });
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

function proxy(req, res, targetUrl) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const backendUrl = targetUrl + url.pathname + (url.search || "");
  const proxyReq = request(
    backendUrl,
    { method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Bad Gateway: ${err.message}`);
  });
  req.pipe(proxyReq);
}

const server = createServer((req, res) => {
  const url = req.url?.split("?")[0] || "/";

  if (url.startsWith("/api/")) {
    proxy(req, res, API_BACKEND);
    return;
  }

  if (url === "/report" || url === "/report/") {
    const reportPath = join(STATIC_DIR, "report.html");
    if (serveFile(res, reportPath, "text/html")) return;
  }

  if (url.startsWith("/report-assets/")) {
    const file = url.slice("/report-assets/".length) || "index.html";
    const filePath = join(WEB_AWESOME_DIR, file);
    const contentType = MIME[extname(file)] || "application/octet-stream";
    if (serveFile(res, filePath, contentType)) return;
  }

  const file = url === "/" ? "index.html" : url.slice(1);
  const filePath = join(STATIC_DIR, file);
  const contentType = MIME[extname(file)] || "application/octet-stream";
  if (serveFile(res, filePath, contentType)) return;

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`Report-app serving at http://localhost:${PORT}`);
  console.log(`  API proxy: /api/ -> ${API_BACKEND}`);
});
