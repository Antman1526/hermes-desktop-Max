import http from "http";
import { AddressInfo } from "net";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPaperclipEnv,
  DEFAULT_PAPERCLIP_URL,
  DEFAULT_PAPERCLIP_VERSION,
  getPaperclipNpmCacheDir,
  mergePaperclipConfigData,
  normalizePaperclipUrl,
  PAPERCLIP_NPX_ARGS,
  PAPERCLIP_STARTUP_TIMEOUT_MS,
  readPaperclipConfigFromData,
  requestHealth,
  resolvePaperclipNpxCommand,
} from "../src/main/paperclip";

describe("Paperclip sidecar config", () => {
  const servers: http.Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          }),
      ),
    );
    servers.length = 0;
  });

  it("normalizes empty and bare Paperclip URLs", () => {
    expect(normalizePaperclipUrl("")).toBe(DEFAULT_PAPERCLIP_URL);
    expect(normalizePaperclipUrl("localhost:3100/")).toBe(
      "http://localhost:3100",
    );
    expect(normalizePaperclipUrl("http://127.0.0.1:3100///")).toBe(
      "http://127.0.0.1:3100",
    );
  });

  it("rejects non-http Paperclip URLs", () => {
    expect(normalizePaperclipUrl("file:///tmp/paperclip")).toBe(
      DEFAULT_PAPERCLIP_URL,
    );
    expect(normalizePaperclipUrl("javascript://alert(1)")).toBe(
      DEFAULT_PAPERCLIP_URL,
    );
  });

  it("reads defaults when desktop config has no Paperclip block", () => {
    expect(readPaperclipConfigFromData({})).toEqual({
      serverUrl: DEFAULT_PAPERCLIP_URL,
      autoStart: true,
      telemetryDisabled: true,
    });
  });

  it("merges Paperclip config without discarding unrelated desktop settings", () => {
    const next = mergePaperclipConfigData(
      { connectionMode: "local", remoteUrl: "http://example.test" },
      { serverUrl: "localhost:3100/", telemetryDisabled: false },
    );

    expect(next).toEqual({
      connectionMode: "local",
      remoteUrl: "http://example.test",
      paperclip: {
        serverUrl: "http://localhost:3100",
        autoStart: true,
        telemetryDisabled: false,
      },
    });
  });

  it("launches the requested Paperclip release through noninteractive npx", () => {
    expect(DEFAULT_PAPERCLIP_VERSION).toBe("2026.529.0");
    expect(PAPERCLIP_NPX_ARGS).toEqual([
      "--yes",
      `paperclipai@${DEFAULT_PAPERCLIP_VERSION}`,
      "run",
    ]);
  });

  it("allows enough time for the pinned Paperclip release to finish startup", () => {
    expect(PAPERCLIP_STARTUP_TIMEOUT_MS).toBeGreaterThanOrEqual(180000);
  });

  it("prefers a known absolute npx launcher when the app PATH is sparse", () => {
    expect(
      resolvePaperclipNpxCommand(
        (candidate) => candidate === "/opt/homebrew/bin/npx",
      ),
    ).toBe("/opt/homebrew/bin/npx");
  });

  it("uses a Hermes-owned npm cache for npx", () => {
    const env = buildPaperclipEnv(
      {
        serverUrl: DEFAULT_PAPERCLIP_URL,
        autoStart: true,
        telemetryDisabled: true,
      },
      { PATH: "/usr/bin" },
    );

    expect(env.PATH).toContain("/usr/bin");
    expect(env.npm_config_cache).toBe(getPaperclipNpmCacheDir());
    expect(env.NPM_CONFIG_CACHE).toBe(getPaperclipNpmCacheDir());
    expect(env.PAPERCLIP_TELEMETRY_DISABLED).toBe("1");
    expect(env.DO_NOT_TRACK).toBe("1");
  });

  it("checks the Paperclip API health endpoint instead of the static UI shell", async () => {
    const requestedPaths: string[] = [];
    const server = http.createServer((req, res) => {
      requestedPaths.push(req.url ?? "");
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end('<!doctype html><div id="root"></div>');
        return;
      }
      if (req.url === "/api/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", version: "2026.529.0" }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    servers.push(server);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const { port } = server.address() as AddressInfo;

    await expect(requestHealth(`http://127.0.0.1:${port}`)).resolves.toBe(true);
    expect(requestedPaths).toEqual(["/api/health"]);
  });
});
