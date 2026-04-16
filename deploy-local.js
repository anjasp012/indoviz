// deploy-local.js (no external dependencies)
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const fs = require("fs/promises");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");

const repoRoot = process.cwd();
const deployDir = path.join(repoRoot, "local-deploy");
const staticSrc = path.join(repoRoot, "site");
const utilSrc = path.join(repoRoot, "util");
const vizSrc = path.join(repoRoot, "viz");

const siteOut = path.join(deployDir, "site");
const vizOut = path.join(siteOut, "viz");
const utilOut = path.join(siteOut, "util");

const PORT = 3001;

async function rmrf(p) {
  try {
    await fs.rm(p, { recursive: true, force: true });
  } catch (err) {
    if (err.code === 'EBUSY') {
      console.warn(`[WARNING] Resource busy saat menghapus ${p}. Pastikan server lama sudah dimatikan.`);
    } else {
      throw err;
    }
  }
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) {
    console.error(result.error);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".map": "application/json; charset=utf-8",
    ".wasm": "application/wasm",
    ".data": "application/octet-stream",
  }[ext] || "application/octet-stream";
}

function startServer(rootDir) {
  const server = http.createServer(async (req, res) => {
    try {
      const reqPath = decodeURIComponent(req.url.split("?")[0]);
      const safePath = reqPath.replace(/\.\./g, "");
      let filePath = path.join(rootDir, safePath);

      // Serve index.html at /
      if (reqPath === "/") {
        filePath = path.join(rootDir, "index.html");
      }

      // If path is a directory, try index.html
      const stat = await fs.stat(filePath).catch(() => null);
      if (stat && stat.isDirectory()) {
        if (!reqPath.endsWith("/") && reqPath !== "") {
          res.writeHead(301, { "Location": reqPath + "/" });
          res.end();
          return;
        }
        filePath = path.join(filePath, "index.html");
      }

      const data = await fs.readFile(filePath);
      res.writeHead(200, { "Content-Type": contentType(filePath) });
      res.end(data);
    } catch (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });

  server.listen(PORT, () => {
    console.log(`Local deploy server running at http://localhost:${PORT}`);
    console.log(`Root: ${rootDir}`);
  });
}

(async () => {
  await rmrf(deployDir);
  await fs.mkdir(deployDir, { recursive: true });

  await copyDir(staticSrc, siteOut);
  await copyDir(utilSrc, utilOut);

  // Build viz into local-deploy/site/viz
  // Ensure viz deps are installed once: cd viz && npm install
  console.log("Building viz into:", vizOut);
  run(npmCmd, ["run", "build", "--", "--outDir", vizOut, "--emptyOutDir"], vizSrc);
  console.log("Viz build complete");

  // Generate dataset list manifest
  try {
    const dataPath = path.join(vizSrc, "public", "data");
    const entries = await fs.readdir(dataPath, { withFileTypes: true });
    const manifest = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subPath = path.join(dataPath, entry.name);
        const subFiles = await fs.readdir(subPath);
        const parquets = subFiles.filter(f => {
          const ext = f.toLowerCase();
          return ext.endsWith(".parquet") || ext.endsWith(".geoparquet");
        });
        const thumbnailFile = subFiles.find(f => {
          const name = f.toLowerCase();
          return name.startsWith("thumbnail.") && (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".gif") || name.endsWith(".webp"));
        });
        if (parquets.length > 0) {
          manifest.push({
            type: "folder",
            name: entry.name,
            files: parquets.map(f => `${entry.name}/${f}`),
            thumbnail: thumbnailFile ? `viz/data/${entry.name}/${thumbnailFile}` : null
          });
        }
      } else if (entry.isFile()) {
        const ext = entry.name.toLowerCase();
        if (ext.endsWith(".parquet") || ext.endsWith(".geoparquet")) {
          manifest.push({
            type: "file",
            name: entry.name,
            path: entry.name
          });
        }
      }
    }

    const manifestContent = JSON.stringify(manifest, null, 2);
    
    // 1. Write to source (for development / npm run dev)
    const srcManifestPath = path.join(dataPath, "datasets.json");
    await fs.writeFile(srcManifestPath, manifestContent);
    console.log("Generated source manifest:", srcManifestPath);

    // 2. Write to deployment (for full deploy test)
    const manifestPath = path.join(vizOut, "data", "datasets.json");
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, manifestContent);
    console.log("Generated deployment manifest:", manifestPath);
  } catch (err) {
    console.warn("Could not generate dataset manifest:", err.message);
  }

  // Serve local-deploy/site
  console.log("Starting local server...");
  startServer(siteOut);
})();
