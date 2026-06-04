# 11 - Build and Deployment Pipeline

Generated from repository state on 2026-06-04. No secrets are included; environment-variable names are documented without values.

## Build Scripts

```json
{
  "format": "prettier --write .",
  "lint": "eslint --cache .",
  "test": "vitest run",
  "typecheck:node": "tsc --noEmit -p tsconfig.node.json --composite false",
  "typecheck:web": "tsc --noEmit -p tsconfig.web.json --composite false",
  "typecheck": "npm run typecheck:node && npm run typecheck:web",
  "start": "electron-vite preview",
  "dev": "electron-vite dev",
  "dev:fresh": "HERMES_HOME=$(mktemp -d -t hermes-fresh) electron-vite dev",
  "build": "npm run typecheck && electron-vite build",
  "postinstall": "electron-builder install-app-deps",
  "build:unpack": "npm run build && electron-builder --dir",
  "build:win": "npm run build && electron-builder --win",
  "build:mac": "npm run build && electron-builder --mac dmg --arm64 --publish never -c.mac.notarize=false",
  "build:linux": "electron-vite build && electron-builder --linux",
  "build:rpm": "npm run build && electron-builder --linux rpm",
  "test:watch": "vitest"
}
```

## Build Flow

1. `npm run typecheck` validates main/preload and renderer TypeScript projects.
2. `electron-vite build` emits `out/main`, `out/preload`, and `out/renderer`.
3. `electron-builder` packages the app by platform.
4. Native modules such as `better-sqlite3` remain runtime dependencies and may be unpacked/rebuilt.

## Packaging Targets

- macOS: ARM64 DMG, hardened runtime, entitlements, notarization disabled for local developer packaging.
- Windows: NSIS setup and portable executable, `hermes-desktop-max.exe`.
- Linux: AppImage, Snap, Deb, RPM.

## Packaging Configuration

```yaml
appId: com.antman.hermes-desktop-max
productName: Hermes Desktop Max
directories:
  buildResources: build
files:
  - out/**
  - resources/**
  - package.json
  - "!**/.vscode/*"
  - "!src/*"
  - "!src/**"
  - "!tests/**"
  - "!docs/**"
  - "!scripts/**"
  - "!coverage/**"
  - "!*.log"
  - "!**/*.map"
  - "!**/.cache/**"
  - "!electron.vite.config.{js,ts,mjs,cjs}"
  - "!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}"
  - "!{.env,.env.*,.npmrc,pnpm-lock.yaml}"
  - "!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}"
asarUnpack:
  - resources/**
win:
  executableName: hermes-desktop-max
  target:
    - nsis
    - portable
portable:
  artifactName: ${name}-${version}-portable.${ext}
nsis:
  artifactName: ${name}-${version}-setup.${ext}
  shortcutName: ${productName}
  uninstallDisplayName: ${productName}
  createDesktopShortcut: always
  oneClick: true
  perMachine: false
mac:
  artifactName: hermes-desktop-max-${version}-${arch}-${os}.${ext}
  icon: build/icon.icns
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.inherit.plist
  extendInfo:
    - NSCameraUsageDescription: Application requests access to the device's camera.
    - NSMicrophoneUsageDescription: Application requests access to the device's microphone.
    - NSDocumentsFolderUsageDescription: Application requests access to the user's Documents folder.
    - NSDownloadsFolderUsageDescription: Application requests access to the user's Downloads folder.
  hardenedRuntime: true
  gatekeeperAssess: false
  notarize: false
dmg:
  artifactName: hermes-desktop-max-${version}-${arch}.${ext}
linux:
  target:
    - AppImage
    - snap
    - deb
    - rpm
  maintainer: electronjs.org
  vendor: Antman
  category: Utility
  synopsis: Self-improving AI assistant desktop app
  description: >-
    Hermes Desktop is a native desktop app for installing, configuring, and chatting
    with Hermes Agent — a self-improving AI assistant with tool use, multi-platform
    messaging, and a closed learning loop.
appImage:
  artifactName: ${name}-${version}.${ext}
deb:
  # Run chmod 4755 on chrome-sandbox so Electron's setuid sandbox helper
  # works on modern Linux distros that disable unprivileged user
  # namespaces (Ubuntu 24.04+, etc.). Closes #395.
  afterInstall: build/linux-after-install.sh
rpm:
  artifactName: ${name}-${version}.${ext}
  # Same SUID fix for .rpm consumers (Fedora 40+ also restricts userns).
  afterInstall: build/linux-after-install.sh
npmRebuild: false
publish:
  provider: github
  owner: Antman1526
  repo: hermes-desktop-Max
```

## Winget

`scripts/generate-winget-manifests.mjs` uses templates under `build/winget` to generate Windows package metadata for release artifacts.

## Local Unsigned Build Notes

Local build machines without signing credentials can produce artifacts by overriding code signing/notarization:

```bash
npm run build:mac
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win nsis --x64 --publish never
```

Unsigned artifacts install but trigger Gatekeeper/SmartScreen warnings.

## Release Artifacts

Expected artifact names:

- `hermes-desktop-max-0.5.2-arm64.dmg`
- `Hermes Desktop Max.app`
- `hermes-desktop-0.5.2-setup.exe`
- `hermes-desktop-0.5.2-portable.exe`
- `hermes-desktop-0.5.2.AppImage`
- `hermes-desktop-0.5.2.deb`
- `hermes-desktop-0.5.2.rpm`

## Areas for Review

- Should the project add CI jobs for typecheck/test/package matrix?
- Should package artifacts include SBOM/checksums for local install verification?
