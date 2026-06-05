import { createHash } from "crypto";
import { existsSync, readdirSync, statSync } from "fs";
import { basename, extname, join } from "path";
import { HERMES_HOME } from "./installer";
import { getLocalModelRoots, DEFAULT_LOCAL_MODEL_ROOTS } from "./config";
import type { SavedModel } from "./models";
import { safeWriteFile } from "./utils";

export const LOCAL_MODEL_ROOTS = DEFAULT_LOCAL_MODEL_ROOTS;

export interface LocalModelFile {
  path: string;
  root: string;
  format: "gguf" | "safetensors";
  size?: number;
  mtimeMs?: number;
}

export interface LocalModelRootStatus {
  path: string;
  available: boolean;
  modelCount: number;
}

export interface LocalModelScanStatus {
  createdAt: number;
  roots: LocalModelRootStatus[];
  files: LocalModelFile[];
}

const SUPPORTED_FORMATS = new Set([".gguf", ".safetensors"]);
const DEFAULT_LOCAL_BASE_URL = "http://localhost:8080/v1";
const MIN_LOCAL_MODEL_BYTES = 1 * 1024 * 1024;
const LOCAL_MODEL_SCAN_CACHE_FILE = join(HERMES_HOME, "local-model-scan.json");

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
  roots: string[] = getLocalModelRoots(),
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
      try {
        const stat = statSync(entryPath);
        if (stat.size < MIN_LOCAL_MODEL_BYTES) continue;
        found.push({
          path: entryPath,
          root,
          format: ext.slice(1) as LocalModelFile["format"],
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      } catch {
        continue;
      }
    }
  }

  for (const root of roots) {
    if (existsSync(root)) visit(root, root);
  }

  return found;
}

function writeLocalModelScanCache(status: LocalModelScanStatus): void {
  try {
    safeWriteFile(LOCAL_MODEL_SCAN_CACHE_FILE, JSON.stringify(status, null, 2));
  } catch {
    /* best effort */
  }
}

export function getLocalModelScanStatus(
  roots: string[] = getLocalModelRoots(),
): LocalModelScanStatus {
  const files = discoverLocalModelFiles(roots);
  const rootsStatus = roots.map((root) => ({
    path: root,
    available: existsSync(root),
    modelCount: files.filter((file) => file.root === root).length,
  }));
  const status = {
    createdAt: Date.now(),
    roots: rootsStatus,
    files,
  };
  writeLocalModelScanCache(status);
  return status;
}

export function rescanLocalModels(roots: string[] = getLocalModelRoots()): {
  status: LocalModelScanStatus;
  models: SavedModel[];
} {
  const status = getLocalModelScanStatus(roots);
  return {
    status,
    models: buildLocalModelEntries(status.files),
  };
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
    modelRoot: file.root,
    modelFormat: file.format,
    launchable: file.format === "gguf",
    available: true,
    rootAvailable: true,
    createdAt: Date.now(),
  }));
}

function inferRoot(
  modelPath: string | undefined,
  roots: string[],
): string | undefined {
  if (!modelPath) return undefined;
  return roots.find(
    (root) => modelPath === root || modelPath.startsWith(`${root}/`),
  );
}

export function mergeDiscoveredLocalModelEntries(
  existing: SavedModel[],
  {
    discovered,
    roots = LOCAL_MODEL_ROOTS,
  }: { discovered: SavedModel[]; roots?: string[] },
): SavedModel[] {
  const discoveredByModel = new Map(
    discovered.map((entry) => [`${entry.provider}:${entry.model}`, entry]),
  );
  const seen = new Set<string>();

  const reconciled = existing.map((entry) => {
    if (entry.source !== "local-file") return entry;

    const key = `${entry.provider}:${entry.model}`;
    const fresh = discoveredByModel.get(key);
    if (fresh) {
      seen.add(key);
      return {
        ...entry,
        baseUrl: fresh.baseUrl,
        modelPath: fresh.modelPath,
        modelRoot: fresh.modelRoot,
        modelFormat: fresh.modelFormat,
        launchable: fresh.launchable,
        available: true,
        rootAvailable: true,
        unavailableReason: undefined,
      };
    }

    const modelRoot = entry.modelRoot || inferRoot(entry.modelPath, roots);
    const rootAvailable = modelRoot ? existsSync(modelRoot) : false;
    const unavailableReason =
      modelRoot && !rootAvailable
        ? `Model folder is not mounted: ${modelRoot}`
        : `Model file is missing: ${entry.modelPath || entry.model}`;

    return {
      ...entry,
      modelRoot,
      available: false,
      rootAvailable,
      unavailableReason,
    };
  });

  for (const entry of discovered) {
    const key = `${entry.provider}:${entry.model}`;
    if (
      !seen.has(key) &&
      !existing.some((m) => `${m.provider}:${m.model}` === key)
    ) {
      reconciled.push(entry);
    }
  }

  return reconciled;
}
