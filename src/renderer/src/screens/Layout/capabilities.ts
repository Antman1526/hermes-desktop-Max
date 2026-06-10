export type ConnectionMode = "local" | "remote" | "ssh";

export type FeatureAvailability = "available" | "read-only" | "unavailable";

export type LayoutFeature =
  | "chat"
  | "sessions"
  | "agents"
  | "office"
  | "paperclip"
  | "models"
  | "providers"
  | "skills"
  | "soul"
  | "memory"
  | "tools"
  | "schedules"
  | "kanban"
  | "gateway"
  | "settings";

export interface FeatureCapability {
  feature: LayoutFeature;
  mode: ConnectionMode;
  availability: FeatureAvailability;
  remoteNoticeFeature?: string;
}

const FEATURE_LABELS: Record<LayoutFeature, string> = {
  chat: "Chat",
  sessions: "Sessions",
  agents: "Profiles",
  office: "Office",
  paperclip: "Paperclip",
  models: "Models",
  providers: "Providers",
  skills: "Skills",
  soul: "Persona",
  memory: "Memory",
  tools: "Tools",
  schedules: "Schedules",
  kanban: "Kanban",
  gateway: "Gateway",
  settings: "Settings",
};

const HTTP_REMOTE_AVAILABLE = new Set<LayoutFeature>([
  "chat",
  "office",
  "paperclip",
  "models",
  "schedules",
  "settings",
]);

// Pure HTTP remote mode only has the Hermes API surface. SSH mode can
// execute remote CLI/file operations through ssh-remote.ts, so it keeps the
// broader desktop control plane enabled.
export function getFeatureCapability(
  feature: LayoutFeature,
  mode: ConnectionMode,
): FeatureCapability {
  if (mode === "local" || mode === "ssh") {
    return { feature, mode, availability: "available" };
  }

  return {
    feature,
    mode,
    availability: HTTP_REMOTE_AVAILABLE.has(feature)
      ? "available"
      : "unavailable",
    remoteNoticeFeature: FEATURE_LABELS[feature],
  };
}

export function isFeatureAvailable(
  feature: LayoutFeature,
  mode: ConnectionMode,
): boolean {
  return getFeatureCapability(feature, mode).availability !== "unavailable";
}
