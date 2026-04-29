# Windows and OpenChronicle Support Design

## Goal

Improve Hermes Agent Desktop so it can support Windows 11 local-agent workflows and expose OpenChronicle as a memory option in the Memory Providers screen.

## Current State

Hermes Desktop already has a Windows build target through Electron Builder (`npm run build:win` and NSIS config). The local Hermes Agent runtime code is mostly Unix-oriented:

- virtualenv Python path is hardcoded as `venv/bin/python`
- PATH joining uses `:`
- installer startup invokes `bash`
- shell profile discovery checks Unix shell files

The Memory screen already supports provider discovery through `plugins/memory` and lets users activate `memory.provider` in `config.yaml`.

OpenChronicle is a local-first memory system. Its README marks the project as macOS-only early alpha, and its best-supported integration path is a read-only MCP endpoint at `http://127.0.0.1:8742/mcp`.

Sources:

- OpenChronicle repository: https://github.com/Einsia/OpenChronicle
- OpenChronicle MCP docs: https://raw.githubusercontent.com/Einsia/OpenChronicle/main/docs/mcp.md

## Windows Runtime Design

Add platform-aware runtime helpers in the main process:

- `hermesPythonPath()` returns `venv/Scripts/python.exe` on Windows and `venv/bin/python` elsewhere.
- `pathListSeparator()` returns `;` on Windows and `:` elsewhere.
- `getEnhancedPath()` uses the platform separator and Windows-friendly executable search paths.
- Installer status and Hermes subprocess calls use the helper path instead of the hardcoded Unix Python path.

For installation:

- Native Windows support is preferred when a Windows-compatible Hermes Agent installer is available.
- WSL2/bash remains a fallback path for Unix-oriented Hermes Agent tooling.
- The Desktop app should clearly report unsupported native install state instead of failing with a missing `bash` error.

## Local Model Design

Local model endpoints remain URL-based and work across platforms when the services expose localhost:

- Ollama: `http://localhost:11434/v1`
- Docker Model Runner: `http://localhost:12434/engines/v1`

No Windows-specific model filesystem path should be required for chat model selection.

## OpenChronicle Design

Add `openchronicle` as an optional memory provider:

- Display name: `OpenChronicle`
- Description: local-first timeline memory through OpenChronicle MCP
- Config/env field: `OPENCHRONICLE_MCP_URL`
- Default URL: `http://127.0.0.1:8742/mcp`
- Website/docs link: `https://github.com/Einsia/OpenChronicle`

When activated, Hermes Desktop should:

- set `memory.provider` to `openchronicle`
- store `OPENCHRONICLE_MCP_URL` if unset
- add or update `mcp_servers.openchronicle` in `config.yaml` as a Streamable HTTP MCP server using the configured URL

OpenChronicle capture remains macOS-only. Windows builds may still show the provider as a remote/local MCP endpoint option if a reachable endpoint is provided.

## Testing

Add tests for:

- Windows Python path resolution uses `venv/Scripts/python.exe`
- PATH separator is `;` on Windows and `:` elsewhere
- memory provider discovery metadata includes `openchronicle`
- OpenChronicle MCP config writing produces an `mcp_servers.openchronicle` block
- i18n strings exist for OpenChronicle in English and Chinese

## Out Of Scope

- Porting OpenChronicle's macOS capture app to Windows
- Replacing Hermes Agent's official installer
- Building or signing a Windows release artifact in this implementation slice
