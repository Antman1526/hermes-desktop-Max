# 05 - Frontend Architecture and Components

Generated from repository state on 2026-06-12. No secrets are included; environment-variable names are documented without values.

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
   6 | export interface LocalModelReadiness {
   7 |   state: "idle" | "starting" | "ready" | "error";
   8 |   message?: string;
   9 | }
  10 |
  11 | interface UseModelConfigResult {
  12 |   currentModel: string;
  13 |   currentProvider: string;
  14 |   currentBaseUrl: string;
  15 |   modelGroups: ModelGroup[];
  16 |   displayModel: string;
  17 |   localModelReadiness: LocalModelReadiness;
  18 |   reload: () => Promise<void>;
  19 |   selectModel: (
  20 |     provider: string,
  21 |     model: string,
  22 |     baseUrl: string,
  23 |     options?: {
  24 |       launchable?: boolean;
  25 |       modelPath?: string;
  26 |       available?: boolean;
  27 |       unavailableReason?: string;
  28 |     },
  29 |   ) => Promise<void>;
  30 | }
  31 |
  32 | function groupModelsByProvider(
  33 |   models: {
  34 |     provider: string;
  35 |     model: string;
  36 |     name: string;
  37 |     baseUrl?: string;
  38 |     source?: "default" | "custom-provider" | "local-file";
  39 |     modelPath?: string;
  40 |     modelRoot?: string;
  41 |     modelFormat?: "gguf" | "safetensors";
  42 |     launchable?: boolean;
  43 |     available?: boolean;
  44 |     rootAvailable?: boolean;
  45 |     unavailableReason?: string;
  46 |   }[],
  47 | ): ModelGroup[] {
  48 |   const groupMap = new Map<string, ModelGroup>();
  49 |   for (const m of models) {
  50 |     if (!groupMap.has(m.provider)) {
  51 |       groupMap.set(m.provider, {
  52 |         provider: m.provider,
  53 |         providerLabel: PROVIDERS.labels[m.provider] || m.provider,
  54 |         models: [],
  55 |       });
  56 |     }
  57 |     groupMap.get(m.provider)!.models.push({
  58 |       provider: m.provider,
  59 |       model: m.model,
  60 |       label: m.name,
  61 |       baseUrl: m.baseUrl || "",
  62 |       source: m.source,
  63 |       modelPath: m.modelPath,
  64 |       modelRoot: m.modelRoot,
  65 |       modelFormat: m.modelFormat,
  66 |       launchable: m.launchable,
  67 |       available: m.available,
  68 |       rootAvailable: m.rootAvailable,
  69 |       unavailableReason: m.unavailableReason,
  70 |     });
  71 |   }
  72 |   return Array.from(groupMap.values());
  73 | }
  74 |
  75 | export function useModelConfig(profile?: string): UseModelConfigResult {
  76 |   const { t } = useI18n();
  77 |   const [currentModel, setCurrentModel] = useState("");
  78 |   const [currentProvider, setCurrentProvider] = useState("auto");
  79 |   const [currentBaseUrl, setCurrentBaseUrl] = useState("");
  80 |   const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
  81 |   const [localModelReadiness, setLocalModelReadiness] =
  82 |     useState<LocalModelReadiness>({
  83 |       state: "idle",
  84 |     });
  85 |
  86 |   const reload = useCallback(async (): Promise<void> => {
  87 |     const [mc, savedModels] = await Promise.all([
  88 |       window.hermesAPI.getModelConfig(profile),
  89 |       window.hermesAPI.listModels(),
  90 |     ]);
  91 |     setCurrentModel(mc.model);
  92 |     setCurrentProvider(mc.provider);
  93 |     setCurrentBaseUrl(mc.baseUrl);
  94 |     setModelGroups(groupModelsByProvider(savedModels));
  95 |   }, [profile]);
  96 |
  97 |   // Initial load + reload whenever the profile changes (canonical
  98 |   // load-on-mount; setState happens inside `reload` via an awaited IPC call).
  99 |   useEffect(() => {
 100 |     reload();
 101 |   }, [reload]);
 102 |
 103 |   const selectModel = useCallback(
 104 |     async (
 105 |       provider: string,
 106 |       model: string,
 107 |       baseUrl: string,
 108 |       options?: {
 109 |         launchable?: boolean;
 110 |         modelPath?: string;
 111 |         available?: boolean;
 112 |         unavailableReason?: string;
 113 |       },
 114 |     ): Promise<void> => {
 115 |       // Named providers (deepseek, groq, anthropic, …) have a hardcoded
 116 |       // canonical base_url in `hermes-agent`'s PROVIDER_REGISTRY.  A stored
 117 |       // model entry that carries a stale `baseUrl` from an earlier confused
 118 |       // save (e.g. a deepseek-tagged entry whose baseUrl points at the codex
 119 |       // endpoint) would route the request to the wrong host.  Drop the
 120 |       // baseUrl whenever the entry isn't `custom`; the gateway falls back
 121 |       // to the provider's canonical URL.
 122 |       let effectiveBaseUrl = provider === "custom" ? baseUrl : "";
 123 |       if (options?.available === false) {
 124 |         setLocalModelReadiness({
 125 |           state: "error",
 126 |           message: options.unavailableReason || "Local model is unavailable.",
 127 |         });
 128 |         return;
 129 |       }
 130 |       if (options?.launchable && options.modelPath) {
 131 |         setLocalModelReadiness({
 132 |           state: "starting",
 133 |           message: "Starting local model server...",
 134 |         });
 135 |         const status = await window.hermesAPI.startLocalModelServer(
 136 |           options.modelPath,
 137 |         );
 138 |         if (status.error) {
 139 |           setLocalModelReadiness({
 140 |             state: "error",
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
   7 |   autoStart: boolean;
   8 |   telemetryDisabled: boolean;
   9 | }
  10 |
  11 | interface PaperclipStatus {
  12 |   serverUrl: string;
  13 |   running: boolean;
  14 |   managed: boolean;
  15 |   launcherAvailable: boolean;
  16 |   launcherDetail: string | null;
  17 |   health: "ok" | "unreachable";
  18 | }
  19 |
  20 | function Paperclip(): React.JSX.Element {
  21 |   const { t } = useI18n();
  22 |   const [config, setConfig] = useState<PaperclipConfig>({
  23 |     serverUrl: "http://127.0.0.1:3100",
  24 |     autoStart: true,
  25 |     telemetryDisabled: true,
  26 |   });
  27 |   const [status, setStatus] = useState<PaperclipStatus | null>(null);
  28 |   const [loading, setLoading] = useState(true);
  29 |   const [saving, setSaving] = useState(false);
  30 |   const [action, setAction] = useState<"starting" | "stopping" | null>(null);
  31 |   const [message, setMessage] = useState<string | null>(null);
  32 |   const [messageType, setMessageType] = useState<"success" | "error">(
  33 |     "success",
  34 |   );
  35 |
  36 |   const refresh = useCallback(async (): Promise<void> => {
  37 |     const nextStatus = await window.hermesAPI.paperclipStatus();
  38 |     setStatus(nextStatus);
  39 |   }, []);
  40 |
  41 |   useEffect(() => {
  42 |     let mounted = true;
  43 |     Promise.all([
  44 |       window.hermesAPI.getPaperclipConfig(),
  45 |       window.hermesAPI.paperclipStatus(),
  46 |     ])
  47 |       .then(([nextConfig, nextStatus]) => {
  48 |         if (!mounted) return;
  49 |         setConfig(nextConfig);
  50 |         setStatus(nextStatus);
  51 |       })
  52 |       .finally(() => {
  53 |         if (mounted) setLoading(false);
  54 |       });
  55 |     return () => {
  56 |       mounted = false;
  57 |     };
  58 |   }, []);
  59 |
  60 |   async function handleSave(): Promise<void> {
  61 |     setSaving(true);
  62 |     setMessage(null);
  63 |     try {
  64 |       const next = await window.hermesAPI.setPaperclipConfig(config);
  65 |       setConfig(next);
  66 |       await refresh();
  67 |       setMessageType("success");
  68 |       setMessage(t("paperclip.saved"));
  69 |     } catch (err) {
  70 |       setMessageType("error");
  71 |       setMessage((err as Error).message);
  72 |     } finally {
  73 |       setSaving(false);
  74 |     }
  75 |   }
  76 |
  77 |   async function handleStart(): Promise<void> {
  78 |     setAction("starting");
  79 |     setMessage(null);
  80 |     const result = await window.hermesAPI.startPaperclip();
  81 |     await refresh();
  82 |     if (result.success) {
  83 |       await window.hermesAPI.openPaperclip();
  84 |     }
  85 |     setAction(null);
  86 |     setMessageType(result.success ? "success" : "error");
  87 |     setMessage(
  88 |       result.success
  89 |         ? t("paperclip.started")
  90 |         : result.error || t("paperclip.startFailed"),
  91 |     );
  92 |   }
  93 |
  94 |   async function handleStop(): Promise<void> {
  95 |     setAction("stopping");
  96 |     setMessage(null);
  97 |     const result = await window.hermesAPI.stopPaperclip();
  98 |     await refresh();
  99 |     setAction(null);
 100 |     setMessageType(result.success ? "success" : "error");
 101 |     setMessage(
 102 |       result.success
 103 |         ? t("paperclip.stopped")
 104 |         : result.error || t("paperclip.stopFailed"),
 105 |     );
 106 |   }
 107 |
 108 |   const running = status?.running ?? false;
 109 |   const managed = status?.managed ?? false;
 110 |
 111 |   return (
 112 |     <div className="settings-container">
 113 |       <h1 className="settings-header">{t("paperclip.title")}</h1>
 114 |
 115 |       <div className="settings-section">
 116 |         <div className="settings-section-title">{t("paperclip.status")}</div>
 117 |         {loading ? (
 118 |           <div className="settings-field-value">{t("common.loading")}</div>
 119 |         ) : (
 120 |           <>
 121 |             <div className="settings-field">
 122 |               <label className="settings-field-label">
 123 |                 {t("paperclip.server")}
 124 |               </label>
 125 |               <div className="settings-field-value">
 126 |                 {status?.serverUrl || config.serverUrl}
 127 |               </div>
 128 |             </div>
 129 |             <div className="settings-field">
 130 |               <label className="settings-field-label">
```

## Internationalization

`src/shared/i18n` provides locale typing and translation helpers. English is the primary locale, with additional locale files under `src/shared/i18n/locales`. Renderer components use `I18nProvider`, `useI18n`, and shared locale keys.

## State Management

The project uses React state and hooks instead of Redux/Zustand. Most durable state is loaded through `window.hermesAPI` and stored in local component state. This keeps state localized, but cross-screen settings can cause repeated loading and implicit coupling through files.

## Areas for Review

- Would a typed query/cache layer reduce duplicate loading logic across screens?
- Should screen-level state be colocated into domain hooks that mirror main modules?
- Are the large screens candidates for reducer-based state machines to make async transitions easier to test?
