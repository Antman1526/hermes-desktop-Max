import { appendFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

function formatDetail(detail: unknown): string {
  if (detail === undefined) return "";
  if (detail instanceof Error) return ` ${detail.stack || detail.message}`;
  if (typeof detail === "string") return ` ${detail}`;

  try {
    return ` ${JSON.stringify(detail)}`;
  } catch {
    return ` ${String(detail)}`;
  }
}

function logBootstrap(event: string, detail?: unknown): void {
  const fallbackHome = process.env.HOME || process.cwd();
  const logPath =
    process.env.HERMES_STARTUP_LOG ||
    join(fallbackHome, ".hermes", "hermes-desktop-startup.log");
  const line = `${new Date().toISOString()} pid=${process.pid} bootstrap ${event}${formatDetail(detail)}\n`;

  try {
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, line);
  } catch {
    try {
      appendFileSync("/tmp/hermes-desktop-startup.log", line);
    } catch {
      // Startup diagnostics must never change app behavior.
    }
  }
}

process.on("uncaughtException", (err) => {
  logBootstrap("uncaughtException", err);
  console.error("[BOOTSTRAP UNCAUGHT]", err);
});

process.on("unhandledRejection", (reason) => {
  logBootstrap("unhandledRejection", reason);
  console.error("[BOOTSTRAP UNHANDLED REJECTION]", reason);
});

logBootstrap("loading app-main", {
  argv: process.argv,
  execPath: process.execPath,
  resourcesPath: process.resourcesPath,
  versions: process.versions,
});

void import("./app-main")
  .then(() => {
    logBootstrap("loaded app-main");
  })
  .catch((err) => {
    logBootstrap("app-main import failed", err);
    console.error("[BOOTSTRAP IMPORT FAILED]", err);
    throw err;
  });
