import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const source = fileURLToPath(new URL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url));
const target = resolve("public/maplibre-gl-worker.mjs");

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
