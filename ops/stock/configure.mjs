import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
const home = homedir();
const dir = join(home, ".config/tolley-stock");
mkdirSync(dir, { recursive: true, mode: 0o700 });
const envfile = join(dir, "worker.env");
const previous = existsSync(envfile)
  ? parseEnv(readFileSync(envfile, "utf8"))
  : {};
if (!process.env.EMAIL_SERVER_USER || !process.env.EMAIL_SERVER_PASSWORD)
  throw new Error(
    "Load the existing mail environment before configuring stock",
  );
const values = {
  STOCK_BASE_URL: "https://www.tolley.io",
  STOCK_WORKER_TOKEN:
    previous.STOCK_WORKER_TOKEN || randomBytes(32).toString("hex"),
  STOCK_MAIL_USER: process.env.EMAIL_SERVER_USER,
  STOCK_MAIL_PASSWORD: process.env.EMAIL_SERVER_PASSWORD,
  STOCK_INTAKE_ADDRESS: "jared+stock@yourkchomes.com",
  STOCK_BROWSER_CDP: "http://127.0.0.1:9222",
};
writeFileSync(
  envfile,
  Object.entries(values)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
mkdirSync(join(home, ".local/state/tolley-stock"), {
  recursive: true,
  mode: 0o700,
});
console.log("Private worker environment prepared. No credentials printed.");
if (process.argv.includes("--vercel"))
  for (const key of ["STOCK_WORKER_TOKEN", "STOCK_INTAKE_ADDRESS"]) {
    const result = spawnSync(
      "vercel",
      [
        "env",
        "add",
        key,
        "production",
        "--yes",
        ...(key.endsWith("TOKEN") ? ["--sensitive"] : []),
      ],
      { input: values[key], encoding: "utf8" },
    );
    if (result.status !== 0) {
      console.error(
        `Could not add ${key}; verify whether it already exists using vercel env ls.`,
      );
      process.exit(1);
    }
    console.log(`${key} configured for production.`);
  }
