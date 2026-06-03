# 05 - Frontend Architecture and Components

Generated from repository state on 2026-06-03. No secrets are included; environment-variable names are documented without values.

## Renderer Stack

The renderer is a React 19 + Vite application. Tailwind CSS is loaded through the Vite plugin, with app styles under `src/renderer/src/assets`. Routing is screen/state based inside the React tree rather than a browser router.

## Entry Points

```tsx
   1 | import "./assets/main.css";
   2 |
   3 | import { StrictMode } from "react";
   4 | import { createRoot } from "react-dom/client";
   5 | import App from "./App";
   6 | import { I18nProvider } from "./components/I18nProvider";
   7 | import { initAnalytics } from "./utils/analytics";
   8 |
   9 | // Initialize analytics (privacy-first, only if user consented and key is configured)
  10 | initAnalytics();
  11 |
  12 | createRoot(document.getElementById("root")!).render(
  13 |   <StrictMode>
  14 |     <I18nProvider>
  15 |       <App />
  16 |     </I18nProvider>
  17 |   </StrictMode>,
  18 | );
  19 |
```

```tsx
   1 | import { useState, useEffect, useCallback } from "react";
   2 | import { ThemeProvider } from "./components/ThemeProvider";
   3 | import ErrorBoundary from "./components/ErrorBoundary";
   4 | import Welcome from "./screens/Welcome/Welcome";
   5 | import Install from "./screens/Install/Install";
   6 | import Setup from "./screens/Setup/Setup";
   7 | import Layout from "./screens/Layout/Layout";
   8 | import SplashScreen from "./screens/SplashScreen/SplashScreen";
   9 | import { captureScreenView } from "./utils/analytics";
  10 |
  11 | type Screen = "splash" | "welcome" | "installing" | "setup" | "main";
  12 |
  13 | // Minimum time the splash stays visible so the brand animation plays
  14 | // through. Tracks the splash logo fade-in duration in main.css.
  15 | const SPLASH_MIN_MS = 1300;
  16 |
  17 | function App(): React.JSX.Element {
  18 |   const [screen, setScreen] = useState<Screen>("splash");
  19 |   const [installError, setInstallError] = useState<string | null>(null);
  20 |   const [connectionMode, setConnectionMode] = useState<
  21 |     "local" | "remote" | "ssh"
  22 |   >("local");
  23 |   // Soft warning: install files exist but the deep `verifyInstall` probe
  24 |   // failed (e.g. slow Python startup, restricted network). We surface this
  25 |   // as a dismissible banner instead of bouncing the user back to Welcome,
  26 |   // which previously trapped restricted-network users in a reinstall
  27 |   // loop on every launch (#130).
  28 |   const [verifyWarning, setVerifyWarning] = useState(false);
  29 |   const isMac = window.electron?.process?.platform === "darwin";
  30 |
  31 |   const runInstallCheck = useCallback(async () => {
  32 |     const startedAt = Date.now();
  33 |     let next: Screen = "welcome";
  34 |     let error: string | null = null;
  35 |     let isRemote = false;
  36 |
  37 |     try {
  38 |       const conn = await window.hermesAPI.getConnectionConfig();
  39 |       isRemote = conn.mode === "remote" || conn.mode === "ssh";
  40 |       setConnectionMode(conn.mode);
  41 |
  42 |       if (conn.mode === "ssh" && conn.ssh) {
  43 |         // Start (or ensure) the SSH tunnel, then go straight to main
  44 |         try {
  45 |           await window.hermesAPI.startSshTunnel();
  46 |           next = "main";
  47 |         } catch (tunnelErr) {
  48 |           error = `SSH tunnel failed to start: ${(tunnelErr as Error).message}`;
  49 |           next = "welcome";
  50 |         }
  51 |       } else if (conn.mode === "remote" && conn.remoteUrl) {
  52 |         const ok = await window.hermesAPI.testRemoteConnection(conn.remoteUrl);
  53 |         if (ok) {
  54 |           next = "main";
  55 |         } else {
  56 |           error = `Cannot reach remote Hermes at ${conn.remoteUrl}. Check the URL or switch to local mode.`;
  57 |           next = "welcome";
  58 |         }
  59 |       } else {
  60 |         const status = await window.hermesAPI.checkInstall();
  61 |         if (!status.installed) {
  62 |           next = "welcome";
  63 |         } else if (!status.hasApiKey) {
  64 |           next = "setup";
  65 |         } else {
  66 |           next = "main";
  67 |         }
  68 |       }
  69 |     } catch {
  70 |       next = "welcome";
  71 |     }
  72 |
  73 |     if (error) setInstallError(error);
  74 |
  75 |     const elapsed = Date.now() - startedAt;
  76 |     const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  77 |     if (wait > 0) {
  78 |       await new Promise((r) => setTimeout(r, wait));
  79 |     }
  80 |     setScreen(next);
  81 |
  82 |     // Lazy deep-verify in the background after the UI is up. If the
  83 |     // install is broken, surface the warning then — don't block startup.
  84 |     //
  85 |     // Skip for remote-mode connections: verifyInstall() probes the LOCAL
  86 |     // Python + script paths (HERMES_PYTHON / HERMES_SCRIPT in installer.ts),
  87 |     // which don't exist on machines that only use a remote backend. Without
  88 |     // this guard the user is bounced back to Welcome with an "installBroken"
  89 |     // error immediately after a successful remote connect. (#47, #41, #30)
  90 |     if ((next === "main" || next === "setup") && !isRemote) {
  91 |       window.hermesAPI.verifyInstall().then((ok) => {
  92 |         // Files exist (checkInstall passed) but the probe failed. Surface
  93 |         // a soft warning instead of bouncing to Welcome — see #130.
  94 |         if (!ok) setVerifyWarning(true);
  95 |       });
  96 |     }
  97 |   }, []);
  98 |
  99 |   useEffect(() => {
 100 |     runInstallCheck();
 101 |   }, [runInstallCheck]);
 102 |
 103 |   // Track screen views for analytics
 104 |   useEffect(() => {
 105 |     captureScreenView(screen);
 106 |   }, [screen]);
 107 |
 108 |   const handleSplashFinished = useCallback(() => {
 109 |     /* splash transition is driven by the install check, not a timer */
 110 |   }, []);
 111 |
 112 |   function handleInstallComplete(): void {
 113 |     setInstallError(null);
 114 |     setScreen("setup");
 115 |   }
 116 |
 117 |   function handleInstallFailed(error: string): void {
 118 |     setInstallError(error);
 119 |     setScreen("welcome");
 120 |   }
 121 |
 122 |   function handleRetryInstall(): void {
 123 |     setInstallError(null);
 124 |     setScreen("installing");
 125 |   }
 126 |
 127 |   function handleRecheck(): void {
 128 |     setInstallError(null);
 129 |     setScreen("splash");
 130 |     runInstallCheck();
 131 |   }
 132 |
 133 |   async function handleSwitchToLocal(): Promise<void> {
 134 |     await window.hermesAPI.setConnectionConfig("local", "", "");
 135 |     setConnectionMode("local");
 136 |     handleRecheck();
 137 |   }
 138 |
 139 |   function handleVerifyReinstall(): void {
 140 |     setVerifyWarning(false);
 141 |     setInstallError(null);
 142 |     setScreen("installing");
 143 |   }
 144 |
 145 |   function handleDismissVerifyWarning(): void {
 146 |     setVerifyWarning(false);
 147 |   }
 148 |
 149 |   function renderScreen(): React.JSX.Element {
 150 |     switch (screen) {
 151 |       case "splash":
 152 |         return <SplashScreen onFinished={handleSplashFinished} />;
 153 |       case "welcome":
 154 |         return (
 155 |           <Welcome
 156 |             error={installError}
 157 |             connectionMode={connectionMode}
 158 |             onStart={handleRetryInstall}
 159 |             onRecheck={handleRecheck}
 160 |             onSwitchToLocal={handleSwitchToLocal}
```

## Screen Inventory

- `Chat` - streaming chat workspace, message history, model selection, attachments, slash commands.
- `Sessions` - cached and DB-backed session browsing/search.
- `Agents` - profile management.
- `Skills` - bundled/installed/imported skill management.
- `Models` - provider and saved model CRUD.
- `Memory` - memory entries, user profile, provider discovery/configuration.
- `Soul` - persona editor.
- `Tools` - toolset toggles.
- `Schedules` - cron job builder.
- `Gateway` - messaging platform configuration.
- `Office` - Claw3d dev server/adapter management.
- `Paperclip` - Paperclip sidecar configuration and dashboard launch.
- `Settings` - network mode, backup/import, logs, diagnostics, updates, credentials.

## Chat Composition

Chat is decomposed into display components, input components, hooks, and utilities:

- `Chat.tsx` coordinates state and flow.
- `ChatInput.tsx` manages text, attachments, slash commands, and keyboard actions.
- `MessageList.tsx` and `MessageRow.tsx` render transcript items.
- `ModelPicker.tsx` selects provider/model and triggers local server startup for launchable models.
- `useChatIPC.ts` wraps main-process chat calls.
- `useModelConfig.ts` loads/saves model config.

Representative hook:

```tsx
   1 | import { useCallback, useEffect, useMemo, useState } from "react";
   2 | import { PROVIDERS } from "../../../constants";
   3 | import { useI18n } from "../../../components/useI18n";
   4 | import type { ModelGroup } from "../types";
   5 |
   6 | interface UseModelConfigResult {
   7 |   currentModel: string;
   8 |   currentProvider: string;
   9 |   currentBaseUrl: string;
  10 |   modelGroups: ModelGroup[];
  11 |   displayModel: string;
  12 |   reload: () => Promise<void>;
  13 |   selectModel: (
  14 |     provider: string,
  15 |     model: string,
  16 |     baseUrl: string,
  17 |     options?: { launchable?: boolean; modelPath?: string },
  18 |   ) => Promise<void>;
  19 | }
  20 |
  21 | function groupModelsByProvider(
  22 |   models: {
  23 |     provider: string;
  24 |     model: string;
  25 |     name: string;
  26 |     baseUrl?: string;
  27 |     source?: "default" | "custom-provider" | "local-file";
  28 |     modelPath?: string;
  29 |     modelFormat?: "gguf" | "safetensors";
  30 |     launchable?: boolean;
  31 |   }[],
  32 | ): ModelGroup[] {
  33 |   const groupMap = new Map<string, ModelGroup>();
  34 |   for (const m of models) {
  35 |     if (!groupMap.has(m.provider)) {
  36 |       groupMap.set(m.provider, {
  37 |         provider: m.provider,
  38 |         providerLabel: PROVIDERS.labels[m.provider] || m.provider,
  39 |         models: [],
  40 |       });
  41 |     }
  42 |     groupMap.get(m.provider)!.models.push({
  43 |       provider: m.provider,
  44 |       model: m.model,
  45 |       label: m.name,
  46 |       baseUrl: m.baseUrl || "",
  47 |       source: m.source,
  48 |       modelPath: m.modelPath,
  49 |       modelFormat: m.modelFormat,
  50 |       launchable: m.launchable,
  51 |     });
  52 |   }
  53 |   return Array.from(groupMap.values());
  54 | }
  55 |
  56 | export function useModelConfig(profile?: string): UseModelConfigResult {
  57 |   const { t } = useI18n();
  58 |   const [currentModel, setCurrentModel] = useState("");
  59 |   const [currentProvider, setCurrentProvider] = useState("auto");
  60 |   const [currentBaseUrl, setCurrentBaseUrl] = useState("");
  61 |   const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  62 |
  63 |   const reload = useCallback(async (): Promise<void> => {
  64 |     const [mc, savedModels] = await Promise.all([
  65 |       window.hermesAPI.getModelConfig(profile),
  66 |       window.hermesAPI.listModels(),
  67 |     ]);
  68 |     setCurrentModel(mc.model);
  69 |     setCurrentProvider(mc.provider);
  70 |     setCurrentBaseUrl(mc.baseUrl);
  71 |     setModelGroups(groupModelsByProvider(savedModels));
  72 |   }, [profile]);
  73 |
  74 |   // Initial load + reload whenever the profile changes (canonical
  75 |   // load-on-mount; setState happens inside `reload` via an awaited IPC call).
  76 |   useEffect(() => {
  77 |     reload();
  78 |   }, [reload]);
  79 |
  80 |   const selectModel = useCallback(
  81 |     async (
  82 |       provider: string,
  83 |       model: string,
  84 |       baseUrl: string,
  85 |       options?: { launchable?: boolean; modelPath?: string },
  86 |     ): Promise<void> => {
  87 |       // Named providers (deepseek, groq, anthropic, …) have a hardcoded
  88 |       // canonical base_url in `hermes-agent`'s PROVIDER_REGISTRY.  A stored
  89 |       // model entry that carries a stale `baseUrl` from an earlier confused
  90 |       // save (e.g. a deepseek-tagged entry whose baseUrl points at the codex
  91 |       // endpoint) would route the request to the wrong host.  Drop the
  92 |       // baseUrl whenever the entry isn't `custom`; the gateway falls back
  93 |       // to the provider's canonical URL.
  94 |       const effectiveBaseUrl = provider === "custom" ? baseUrl : "";
  95 |       if (options?.launchable && options.modelPath) {
  96 |         const status = await window.hermesAPI.startLocalModelServer(
  97 |           options.modelPath,
  98 |         );
  99 |         if (status.error) throw new Error(status.error);
 100 |       }
 101 |       await window.hermesAPI.setModelConfig(
 102 |         provider,
 103 |         model,
 104 |         effectiveBaseUrl,
 105 |         profile,
 106 |       );
 107 |       setCurrentModel(model);
 108 |       setCurrentProvider(provider);
 109 |       setCurrentBaseUrl(effectiveBaseUrl);
 110 |     },
 111 |     [profile],
 112 |   );
 113 |
 114 |   const displayModel = useMemo(
 115 |     () =>
 116 |       currentModel
 117 |         ? currentModel.split("/").pop() || currentModel
 118 |         : currentProvider === "auto"
 119 |           ? t("chat.auto")
 120 |           : t("chat.noModel"),
 121 |     [currentModel, currentProvider, t],
 122 |   );
 123 |
 124 |   return {
 125 |     currentModel,
 126 |     currentProvider,
 127 |     currentBaseUrl,
 128 |     modelGroups,
 129 |     displayModel,
 130 |     reload,
 131 |     selectModel,
 132 |   };
 133 | }
 134 |
```

## Paperclip Screen Pattern

The Paperclip screen is a compact example of renderer to IPC flow: load status/config, edit URL/telemetry state, start/stop sidecar, and open dashboard through main.

```tsx
   1 | import { useCallback, useEffect, useState } from "react";
   2 | import { ExternalLink, Play, Refresh, Spinner, Stop } from "../../assets/icons";
   3 | import { useI18n } from "../../components/useI18n";
   4 |
   5 | interface PaperclipConfig {
   6 |   serverUrl: string;
   7 |   telemetryDisabled: boolean;
   8 | }
   9 |
  10 | interface PaperclipStatus {
  11 |   serverUrl: string;
  12 |   running: boolean;
  13 |   managed: boolean;
  14 |   launcherAvailable: boolean;
  15 |   launcherDetail: string | null;
  16 |   health: "ok" | "unreachable";
  17 | }
  18 |
  19 | function Paperclip(): React.JSX.Element {
  20 |   const { t } = useI18n();
  21 |   const [config, setConfig] = useState<PaperclipConfig>({
  22 |     serverUrl: "http://127.0.0.1:3100",
  23 |     telemetryDisabled: true,
  24 |   });
  25 |   const [status, setStatus] = useState<PaperclipStatus | null>(null);
  26 |   const [loading, setLoading] = useState(true);
  27 |   const [saving, setSaving] = useState(false);
  28 |   const [action, setAction] = useState<"starting" | "stopping" | null>(null);
  29 |   const [message, setMessage] = useState<string | null>(null);
  30 |   const [messageType, setMessageType] = useState<"success" | "error">(
  31 |     "success",
  32 |   );
  33 |
  34 |   const refresh = useCallback(async (): Promise<void> => {
  35 |     const nextStatus = await window.hermesAPI.paperclipStatus();
  36 |     setStatus(nextStatus);
  37 |   }, []);
  38 |
  39 |   useEffect(() => {
  40 |     let mounted = true;
  41 |     Promise.all([
  42 |       window.hermesAPI.getPaperclipConfig(),
  43 |       window.hermesAPI.paperclipStatus(),
  44 |     ])
  45 |       .then(([nextConfig, nextStatus]) => {
  46 |         if (!mounted) return;
  47 |         setConfig(nextConfig);
  48 |         setStatus(nextStatus);
  49 |       })
  50 |       .finally(() => {
  51 |         if (mounted) setLoading(false);
  52 |       });
  53 |     return () => {
  54 |       mounted = false;
  55 |     };
  56 |   }, []);
  57 |
  58 |   async function handleSave(): Promise<void> {
  59 |     setSaving(true);
  60 |     setMessage(null);
  61 |     try {
  62 |       const next = await window.hermesAPI.setPaperclipConfig(config);
  63 |       setConfig(next);
  64 |       await refresh();
  65 |       setMessageType("success");
  66 |       setMessage(t("paperclip.saved"));
  67 |     } catch (err) {
  68 |       setMessageType("error");
  69 |       setMessage((err as Error).message);
  70 |     } finally {
  71 |       setSaving(false);
  72 |     }
  73 |   }
  74 |
  75 |   async function handleStart(): Promise<void> {
  76 |     setAction("starting");
  77 |     setMessage(null);
  78 |     const result = await window.hermesAPI.startPaperclip();
  79 |     await refresh();
  80 |     if (result.success) {
  81 |       await window.hermesAPI.openPaperclip();
  82 |     }
  83 |     setAction(null);
  84 |     setMessageType(result.success ? "success" : "error");
  85 |     setMessage(
  86 |       result.success
  87 |         ? t("paperclip.started")
  88 |         : result.error || t("paperclip.startFailed"),
  89 |     );
  90 |   }
  91 |
  92 |   async function handleStop(): Promise<void> {
  93 |     setAction("stopping");
  94 |     setMessage(null);
  95 |     const result = await window.hermesAPI.stopPaperclip();
  96 |     await refresh();
  97 |     setAction(null);
  98 |     setMessageType(result.success ? "success" : "error");
  99 |     setMessage(
 100 |       result.success
 101 |         ? t("paperclip.stopped")
 102 |         : result.error || t("paperclip.stopFailed"),
 103 |     );
 104 |   }
 105 |
 106 |   const running = status?.running ?? false;
 107 |   const managed = status?.managed ?? false;
 108 |
 109 |   return (
 110 |     <div className="settings-container">
 111 |       <h1 className="settings-header">{t("paperclip.title")}</h1>
 112 |
 113 |       <div className="settings-section">
 114 |         <div className="settings-section-title">{t("paperclip.status")}</div>
 115 |         {loading ? (
 116 |           <div className="settings-field-value">{t("common.loading")}</div>
 117 |         ) : (
 118 |           <>
 119 |             <div className="settings-field">
 120 |               <label className="settings-field-label">
 121 |                 {t("paperclip.server")}
 122 |               </label>
 123 |               <div className="settings-field-value">
 124 |                 {status?.serverUrl || config.serverUrl}
 125 |               </div>
 126 |             </div>
 127 |             <div className="settings-field">
 128 |               <label className="settings-field-label">
 129 |                 {t("paperclip.health")}
 130 |               </label>
```

## Internationalization

`src/shared/i18n` provides locale typing and translation helpers. English is the primary locale, with additional locale files under `src/shared/i18n/locales`. Renderer components use `I18nProvider`, `useI18n`, and shared locale keys.

## State Management

The project uses React state and hooks instead of Redux/Zustand. Most durable state is loaded through `window.hermesAPI` and stored in local component state. This keeps state localized, but cross-screen settings can cause repeated loading and implicit coupling through files.

## Areas for Review

- Would a typed query/cache layer reduce duplicate loading logic across screens?
- Should screen-level state be colocated into domain hooks that mirror main modules?
- Are the large screens candidates for reducer-based state machines to make async transitions easier to test?
