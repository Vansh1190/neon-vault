import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const binName = process.platform === "win32" ? "eslint.cmd" : "eslint";

let candidate = null;
let cursor = resolve(here);
while (candidate === null) {
  const probe = join(cursor, "node_modules", ".bin", binName);
  if (existsSync(probe)) candidate = probe;
  const parent = dirname(cursor);
  if (parent === cursor) candidate = binName;
  cursor = parent;
}

const result = spawnSync(candidate, [".", ...process.argv.slice(2)], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
