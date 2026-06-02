import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Play, Refresh, Spinner, Stop } from "../../assets/icons";
import { useI18n } from "../../components/useI18n";

interface PaperclipConfig {
  serverUrl: string;
  telemetryDisabled: boolean;
}

interface PaperclipStatus {
  serverUrl: string;
  running: boolean;
  managed: boolean;
  launcherAvailable: boolean;
  launcherDetail: string | null;
  health: "ok" | "unreachable";
}

function Paperclip(): React.JSX.Element {
  const { t } = useI18n();
  const [config, setConfig] = useState<PaperclipConfig>({
    serverUrl: "http://127.0.0.1:3100",
    telemetryDisabled: true,
  });
  const [status, setStatus] = useState<PaperclipStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState<"starting" | "stopping" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );

  const refresh = useCallback(async (): Promise<void> => {
    const nextStatus = await window.hermesAPI.paperclipStatus();
    setStatus(nextStatus);
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      window.hermesAPI.getPaperclipConfig(),
      window.hermesAPI.paperclipStatus(),
    ])
      .then(([nextConfig, nextStatus]) => {
        if (!mounted) return;
        setConfig(nextConfig);
        setStatus(nextStatus);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave(): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      const next = await window.hermesAPI.setPaperclipConfig(config);
      setConfig(next);
      await refresh();
      setMessageType("success");
      setMessage(t("paperclip.saved"));
    } catch (err) {
      setMessageType("error");
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStart(): Promise<void> {
    setAction("starting");
    setMessage(null);
    const result = await window.hermesAPI.startPaperclip();
    await refresh();
    if (result.success) {
      await window.hermesAPI.openPaperclip();
    }
    setAction(null);
    setMessageType(result.success ? "success" : "error");
    setMessage(
      result.success
        ? t("paperclip.started")
        : result.error || t("paperclip.startFailed"),
    );
  }

  async function handleStop(): Promise<void> {
    setAction("stopping");
    setMessage(null);
    const result = await window.hermesAPI.stopPaperclip();
    await refresh();
    setAction(null);
    setMessageType(result.success ? "success" : "error");
    setMessage(
      result.success
        ? t("paperclip.stopped")
        : result.error || t("paperclip.stopFailed"),
    );
  }

  const running = status?.running ?? false;
  const managed = status?.managed ?? false;

  return (
    <div className="settings-container">
      <h1 className="settings-header">{t("paperclip.title")}</h1>

      <div className="settings-section">
        <div className="settings-section-title">{t("paperclip.status")}</div>
        {loading ? (
          <div className="settings-field-value">{t("common.loading")}</div>
        ) : (
          <>
            <div className="settings-field">
              <label className="settings-field-label">
                {t("paperclip.server")}
              </label>
              <div className="settings-field-value">
                {status?.serverUrl || config.serverUrl}
              </div>
            </div>
            <div className="settings-field">
              <label className="settings-field-label">
                {t("paperclip.health")}
              </label>
              <div className="settings-field-value">
                {running ? t("paperclip.running") : t("paperclip.stopped")}
                {managed ? ` ${t("paperclip.managed")}` : ""}
              </div>
            </div>
            <div className="settings-field">
              <label className="settings-field-label">
                {t("paperclip.launcher")}
              </label>
              <div className="settings-field-value">
                {status?.launcherAvailable
                  ? status.launcherDetail || t("paperclip.available")
                  : t("paperclip.missingLauncher")}
              </div>
            </div>
          </>
        )}
        {message && (
          <div className={`settings-hermes-result ${messageType}`}>
            {message}
          </div>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          {t("paperclip.configuration")}
        </div>
        <div className="settings-field">
          <label className="settings-field-label">
            {t("paperclip.serverUrl")}
          </label>
          <input
            className="input"
            type="url"
            value={config.serverUrl}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                serverUrl: event.target.value,
              }))
            }
            placeholder="http://127.0.0.1:3100"
            onBlur={handleSave}
          />
          <div className="settings-field-hint">
            {t("paperclip.serverUrlHint")}
          </div>
        </div>
        <label className="agents-create-clone">
          <input
            type="checkbox"
            checked={config.telemetryDisabled}
            onChange={(event) =>
              setConfig((current) => ({
                ...current,
                telemetryDisabled: event.target.checked,
              }))
            }
            onBlur={handleSave}
          />
          <span>{t("paperclip.disableTelemetry")}</span>
        </label>
        <div className="settings-hermes-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={refresh}>
            <Refresh size={14} />
            {t("paperclip.refresh")}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t("paperclip.saving") : t("paperclip.save")}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">{t("paperclip.actions")}</div>
        <div className="settings-hermes-actions">
          <button
            className="btn btn-primary"
            onClick={handleStart}
            disabled={action !== null || running}
          >
            {action === "starting" ? <Spinner size={14} /> : <Play size={14} />}
            {action === "starting"
              ? t("paperclip.starting")
              : t("paperclip.start")}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleStop}
            disabled={action !== null || !managed}
          >
            <Stop size={14} />
            {action === "stopping"
              ? t("paperclip.stopping")
              : t("paperclip.stop")}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => window.hermesAPI.openPaperclip()}
            disabled={!running}
          >
            <ExternalLink size={14} />
            {t("paperclip.open")}
          </button>
        </div>
        {!managed && running && (
          <div className="settings-field-hint" style={{ marginTop: 12 }}>
            {t("paperclip.externalProcessHint")}
          </div>
        )}
      </div>
    </div>
  );
}

export default Paperclip;
