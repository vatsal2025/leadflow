import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const envFile = path.resolve(root, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const standalone = path.join(root, ".next", "standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  throw new Error("Production build is missing. Run npm run build first.");
}
cpSync(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
});
cpSync(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true },
);
process.env.HOSTNAME = process.env.LEADFLOW_HOST || "127.0.0.1";
await import(pathToFileURL(path.join(standalone, "server.js")).href);
