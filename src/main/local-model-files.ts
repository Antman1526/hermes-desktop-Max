import { createHash } from "crypto";
import { existsSync, readdirSync } from "fs";
import { basename, extname, join } from "path";
import { homedir } from "os";
import type { SavedModel } from "./models";

export const LOCAL_MODEL_ROOTS = [
  "/Volumes/MainStore/Development/AI_Models",
  join(homedir(), "Desktop", "AI_Models"),
];

export interface LocalModelFile {
  path: string;
  root: string;
  format: "gguf" | "safetensors";
}

const SUPPORTED_FORMATS = new Set([".gguf", ".safetensors"]);
const DEFAULT_LOCAL_BASE_URL = "http://localhost:8080/v1";

function modelNameFromPath(path: string): string {
  const withoutExt = basename(path, extname(path));
  return (
    "Local " + withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  );
}

function stableLocalModelId(path: string): string {
  return `local-file-${createHash("sha1").update(path).digest("hex").slice(0, 16)}`;
}

export function discoverLocalModelFiles(
  roots: string[] = LOCAL_MODEL_ROOTS,
): LocalModelFile[] {
  const found: LocalModelFile[] = [];

  function visit(root: string, dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith("._")) continue;
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(root, entryPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      if (!SUPPORTED_FORMATS.has(ext)) continue;
      found.push({
        path: entryPath,
        root,
        format: ext.slice(1) as LocalModelFile["format"],
      });
    }
  }

  for (const root of roots) {
    if (existsSync(root)) visit(root, root);
  }

  return found;
}

export function buildLocalModelEntries(files: LocalModelFile[]): SavedModel[] {
  return files.map((file) => ({
    id: stableLocalModelId(file.path),
    name: modelNameFromPath(file.path),
    provider: "custom",
    model: file.path,
    baseUrl: DEFAULT_LOCAL_BASE_URL,
    source: "local-file",
    modelPath: file.path,
    modelFormat: file.format,
    launchable: file.format === "gguf",
    createdAt: Date.now(),
  }));
}
