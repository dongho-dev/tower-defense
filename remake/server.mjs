import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const rootPrefix = root.endsWith("\\") || root.endsWith("/") ? root : root + "\\";
const port = Number(process.argv[2] || 43127);
const host = process.argv[3] || "127.0.0.1";

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".json", "application/json; charset=utf-8"]
]);

function reply(response, status, body) {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

createServer((request, response) => {
  const url = new URL(request.url || "/", "http://" + host + ":" + port);
  const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^[/\\]+/, "");
  const target = resolve(root, relative);
  if (target !== root && !target.startsWith(rootPrefix)) {
    reply(response, 403, "Forbidden");
    return;
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    reply(response, 404, "Not found");
    return;
  }
  const extension = extname(target).toLowerCase();
  const cacheControl = extension === ".png" || extension === ".webp" ? "public, max-age=3600" : "no-store";
  response.writeHead(200, {
    "content-type": contentTypes.get(extension) || "application/octet-stream",
    "cache-control": cacheControl,
    "x-content-type-options": "nosniff"
  });
  createReadStream(target).pipe(response);
}).listen(port, host, () => {
  console.log("Last Light listening at http://" + host + ":" + port + "/");
});
