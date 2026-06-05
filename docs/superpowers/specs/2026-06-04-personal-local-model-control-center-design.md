# Personal Local Model Control Center Design

Generated from repository state on 2026-06-04.

## Goal

Make Hermes Desktop Max feel like a personal local-AI workstation by moving local model roots out of hard-coded-only behavior and adding a Settings control center for model folders, scan status, and local runtime readiness.

## Scope

This is a first implementation pass for personal use. It intentionally does not add multi-user policy controls, cloud sync, Keychain migration, CI, or a broad IPC architecture rewrite. The app should keep Antman's current defaults but allow them to be changed locally.

## User-Facing Behavior

- Settings gets a new **Local Models** section.
- The section lists configured model folders.
- Defaults are:
  - `/Volumes/MainStore/Development/AI_Models`
  - `/Users/Antman/Desktop/AI_Models`
- Each root shows:
  - path
  - mounted/missing status
  - discovered model count
- User can:
  - add a path manually
  - browse for a folder using the existing `select-folder` IPC
  - remove a path
  - reset to personal defaults
  - rescan models
- Runtime readiness shows:
  - `llama-server` available/missing
  - resolved launcher path when available
  - hint to install llama.cpp with `brew install llama.cpp` when missing
- GGUF local models continue to launch through `llama-server`.
- `.safetensors` files remain discoverable but manual-server only.

## Data Model

`~/.hermes/desktop.json` gains:

```json
{
  "localModelRoots": [
    "/Volumes/MainStore/Development/AI_Models",
    "/Users/Antman/Desktop/AI_Models"
  ]
}
```

If `localModelRoots` is missing, invalid, or empty after sanitization, the app uses the personal defaults.

The app also writes a lightweight scan cache under `HERMES_HOME`:

```json
{
  "createdAt": 1760000000000,
  "roots": [
    {
      "path": "/Users/Antman/Desktop/AI_Models",
      "available": true,
      "modelCount": 4
    }
  ],
  "files": [
    {
      "path": "/Users/Antman/Desktop/AI_Models/Qwen.gguf",
      "root": "/Users/Antman/Desktop/AI_Models",
      "format": "gguf",
      "size": 4380000000,
      "mtimeMs": 1760000000000
    }
  ]
}
```

The cache is used for status display and to avoid unnecessary rewrites. The scan itself remains deterministic and local; no network calls are introduced.

## Main Process Design

Add settings helpers in `src/main/config.ts`:

- `DEFAULT_LOCAL_MODEL_ROOTS`
- `getLocalModelRoots()`
- `setLocalModelRoots(roots: string[])`
- `resetLocalModelRoots()`

Update `src/main/local-model-files.ts`:

- read configured roots by default
- expose `getLocalModelScanStatus()`
- expose `rescanLocalModels()`
- write scan cache after scans
- continue to skip `._*` files and files below 1 MB

Add runtime status in `src/main/local-model-server.ts`:

- expose `getLocalModelRuntimeStatus()`
- report `llamaServerAvailable`
- report `llamaServerPath`
- report install hint

Add IPC handlers in `src/main/index.ts`:

- `get-local-model-settings`
- `set-local-model-roots`
- `reset-local-model-roots`
- `rescan-local-models`
- `local-model-runtime-status`

The existing `list-models` behavior continues to reconcile discovered entries with saved models.

## Renderer Design

Update `src/renderer/src/screens/Settings/Settings.tsx` with a compact local models panel. The panel should use existing button and field styles, avoid nested cards, and stay utilitarian.

State:

- `localModelRoots`
- `newLocalModelRoot`
- `localModelStatus`
- `localRuntimeStatus`
- `localModelsSaving`
- `localModelsScanning`
- `localModelsMessage`

Actions:

- `loadLocalModelSettings()`
- `handleAddLocalModelRoot()`
- `handleBrowseLocalModelRoot()`
- `handleRemoveLocalModelRoot(path)`
- `handleResetLocalModelRoots()`
- `handleRescanLocalModels()`

## Error Handling

- Invalid local model root input is ignored after trimming.
- Duplicate roots are deduplicated.
- Missing roots are preserved and shown as missing.
- Scan failures for one root do not fail the whole scan.
- Runtime missing state shows the exact install hint.

## Testing

Add or update tests for:

- configured roots default to Antman's two roots
- saved roots are trimmed and deduplicated
- empty root list falls back to defaults
- discovery uses configured roots
- scan status reports mounted and missing roots
- runtime status reports missing `llama-server` hint
- packaging config still targets `Antman1526/hermes-desktop-Max`

## Areas for Review

- Should scans become fully async/cancellable in a later pass if external drive traversal still feels slow?
- Should the model root cache eventually store directory mtimes and skip subtrees?
- Should Ollama and LM Studio become launchable runtime options after the `llama-server` path is stable?
