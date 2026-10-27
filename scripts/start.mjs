import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd();
try {
  process.loadEnvFile(resolve(root, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
process.env.TRIP_DATA_DIR = resolve(process.env.TRIP_DATA_DIR || ".data");
process.env.PORT = "8080";
process.env.HOSTNAME = "0.0.0.0";
await mkdir(resolve(root, ".next/standalone/.next"), { recursive: true });
await cp(resolve(root, "public"), resolve(root, ".next/standalone/public"), {
  recursive: true,
});
await cp(
  resolve(root, ".next/static"),
  resolve(root, ".next/standalone/.next/static"),
  { recursive: true },
);
await import(pathToFileURL(resolve(root, ".next/standalone/server.js")).href);
