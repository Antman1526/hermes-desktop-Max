# 02 - Environment Setup and Dependencies

Generated from repository state on 2026-06-04. No secrets are included; environment-variable names are documented without values.

## Toolchain

Required tools:

- Node.js 22-compatible runtime recommended because `@types/node` targets 22 and Electron 39 bundles modern Node.
- npm, using `package-lock.json` lockfile version 3.
- Git for repository operations and Hermes Agent install/update flows.
- Python 3.11+ and `uv` for Hermes Agent local install flows.
- Electron-compatible build hosts: macOS for DMG signing/notarization, Windows or cross-build tooling for NSIS, Linux for native Linux packages.

## Install Commands

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Development starts the Electron/Vite dev runtime. A fresh isolated Hermes home can be used with:

```bash
HERMES_HOME=$(mktemp -d -t hermes-fresh) electron-vite dev
```

## Runtime Dependencies

- `@electron-toolkit/preload` - `^3.0.2`
- `@electron-toolkit/utils` - `^4.0.0`
- `@types/highlight.js` - `^9.12.4`
- `@types/react-syntax-highlighter` - `^15.5.13`
- `@wesbos/code-icons` - `^1.2.4`
- `better-sqlite3` - `^12.8.0`
- `electron-updater` - `^6.3.9`
- `highlight.js` - `^11.11.1`
- `i18next` - `^25.6.0`
- `lucide-react` - `^1.7.0`
- `posthog-js` - `^1.376.0`
- `react-file-icon` - `^1.6.0`
- `react-i18next` - `^15.7.3`
- `react-markdown` - `^10.1.0`
- `react-syntax-highlighter` - `^16.1.1`
- `remark-gfm` - `^4.0.1`
- `vscode-material-icons` - `^0.1.1`

## Development Dependencies

- `@electron-toolkit/eslint-config-prettier` - `^3.0.0`
- `@electron-toolkit/eslint-config-ts` - `^3.1.0`
- `@electron-toolkit/tsconfig` - `^2.0.0`
- `@tailwindcss/vite` - `^4.2.2`
- `@testing-library/dom` - `^10.4.1`
- `@testing-library/jest-dom` - `^6.8.0`
- `@testing-library/react` - `^16.3.0`
- `@types/better-sqlite3` - `^7.6.13`
- `@types/node` - `^22.19.1`
- `@types/react` - `^19.2.7`
- `@types/react-dom` - `^19.2.3`
- `@vitejs/plugin-react` - `^5.1.1`
- `electron` - `^39.2.6`
- `electron-builder` - `^26.0.12`
- `electron-vite` - `^5.0.0`
- `eslint` - `^9.39.1`
- `eslint-plugin-react` - `^7.37.5`
- `eslint-plugin-react-hooks` - `^7.0.1`
- `eslint-plugin-react-refresh` - `^0.4.24`
- `jsdom` - `^26.1.0`
- `playwright` - `^1.60.0`
- `prettier` - `^3.7.4`
- `react` - `^19.2.1`
- `react-dom` - `^19.2.1`
- `tailwindcss` - `^4.2.2`
- `typescript` - `^5.9.3`
- `vite` - `^7.2.6`
- `vitest` - `^4.1.4`

## Build Configuration

Electron Vite defines separate bundles for main, preload, and renderer. The `better-sqlite3` native module is externalized from the main Rollup bundle so it can remain a runtime native dependency.

```ts
import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        external: ["better-sqlite3"],
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/preload/index.ts"),
          askpass: resolve("src/preload/askpass.ts"),
        },
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
      },
    },
    plugins: [tailwindcss(), react()],
  },
});
```

## Test Configuration

Vitest runs jsdom for renderer tests, aliases `@renderer` and `@shared`, and includes both colocated renderer tests and top-level main tests.

```ts
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@renderer": resolve(__dirname, "src/renderer/src"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    passWithNoTests: true,
    setupFiles: ["./src/renderer/src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
  },
});
```

## Lint and Formatting

ESLint combines Electron Toolkit TypeScript rules, React rules, React Hooks rules, Vite refresh rules, and Prettier compatibility.

```js
import { defineConfig } from "eslint/config";
import tseslint from "@electron-toolkit/eslint-config-ts";
import eslintConfigPrettier from "@electron-toolkit/eslint-config-prettier";
import eslintPluginReact from "eslint-plugin-react";
import eslintPluginReactHooks from "eslint-plugin-react-hooks";
import eslintPluginReactRefresh from "eslint-plugin-react-refresh";

export default defineConfig(
  {
    ignores: [
      "**/node_modules",
      "**/dist",
      "**/out",
      ".claude/**",
      ".agents/**",
      "build/**",
      // CDP E2E harness — plain Node CommonJS scripts driving the
      // dev electron via Chrome DevTools Protocol for live testing.
      // They intentionally use require() because they run as one-off
      // `node scripts/*.js` invocations outside the TS build, and
      // they're not part of the shipped app. See scripts/README.md.
      "scripts/e2e-attach.js",
      "scripts/repro-*.js",
      "scripts/probe-*.js",
      "scripts/drive-*.js",
      "scripts/verify-*.js",
    ],
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat["jsx-runtime"],
  {
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": eslintPluginReactHooks,
      "react-refresh": eslintPluginReactRefresh,
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  eslintConfigPrettier,
);
```

## Environment Setup Steps

1. Clone `https://github.com/Antman1526/hermes-desktop-Max.git`.
2. Run `npm install`.
3. Copy `.env.example` only if enabling analytics; do not commit real env files.
4. Run `npm run typecheck` and `npm test`.
5. Run `npm run dev`.
6. On first launch, select local, remote, or SSH connection mode.

## Edge Cases

- Native module rebuilds can fail if Electron headers are missing. `postinstall` runs `electron-builder install-app-deps`.
- macOS production notarization requires Apple credentials; this fork's default `build:mac` disables notarization for local developer DMGs.
- Windows native install paths require `venv/Scripts/python.exe` style paths; WSL remains safer for Unix-heavy Hermes Agent scripts.

## Areas for Review

- Should the project pin Node and npm versions through `.nvmrc`, `.node-version`, or Volta to reduce native-module drift?
- Should `llama.cpp`/`llama-server` be detected during setup and surfaced before the user selects a GGUF model?
- Should the packaging prerequisites be split by target platform to avoid macOS-only signing guidance confusing Windows/Linux contributors?
