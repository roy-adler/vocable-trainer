import fs from "fs";
import path from "path";
import { getDataDir } from "../prompt";

export type MicrosoftTokens = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type?: string;
  scope?: string;
};

const SCOPES = ["User.Read", "Chat.Read", "offline_access"].join(" ");

function tokenPath(): string {
  return path.join(getDataDir(), "microsoft-tokens.json");
}

export function getMicrosoftClientId(): string | null {
  return process.env.MICROSOFT_CLIENT_ID?.trim() || null;
}

/**
 * `common` accepts personal and work/school accounts. A code issued for one
 * authority is rejected by the login page when signing in with the other kind
 * of account, so keep this switchable.
 */
export function getMicrosoftTenant(): string {
  return process.env.MICROSOFT_TENANT?.trim() || "common";
}

function authorityUrl(endpoint: "devicecode" | "token"): string {
  return `https://login.microsoftonline.com/${getMicrosoftTenant()}/oauth2/v2.0/${endpoint}`;
}

export function isMicrosoftConfigured(): boolean {
  return Boolean(getMicrosoftClientId());
}

export function readTokens(): MicrosoftTokens | null {
  const p = tokenPath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as MicrosoftTokens;
  } catch {
    return null;
  }
}

export function writeTokens(tokens: MicrosoftTokens): void {
  fs.mkdirSync(getDataDir(), { recursive: true });
  fs.writeFileSync(tokenPath(), JSON.stringify(tokens, null, 2), "utf8");
}

export function clearTokens(): void {
  const p = tokenPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function isTokenValid(tokens: MicrosoftTokens | null): boolean {
  if (!tokens?.access_token) return false;
  return tokens.expires_at > Date.now() + 60_000;
}

type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
  message: string;
};

export async function startDeviceCode(
  fetchImpl: typeof fetch = fetch,
): Promise<DeviceCodeResponse> {
  const clientId = getMicrosoftClientId();
  if (!clientId) {
    throw new Error("MICROSOFT_CLIENT_ID ist nicht gesetzt.");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
  });
  const res = await fetchImpl(authorityUrl("devicecode"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Device-Code Start fehlgeschlagen (${res.status}, Tenant "${getMicrosoftTenant()}"). ${detail}`.trim(),
    );
  }
  return (await res.json()) as DeviceCodeResponse;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export type PollResult =
  | { status: "pending"; slowDown: boolean }
  | { status: "ok"; tokens: MicrosoftTokens }
  | { status: "error"; message: string; code: string };

const TERMINAL_ERROR_MESSAGES: Record<string, string> = {
  expired_token:
    "Der Code ist abgelaufen oder wurde von Microsoft verworfen. Bitte einen neuen Code anfordern.",
  authorization_declined: "Die Anmeldung wurde abgebrochen.",
  bad_verification_code:
    "Microsoft kennt diesen Code nicht (mehr). Bitte einen neuen Code anfordern.",
};

export async function pollDeviceCode(
  deviceCode: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PollResult> {
  const clientId = getMicrosoftClientId();
  if (!clientId) {
    return {
      status: "error",
      message: "MICROSOFT_CLIENT_ID fehlt.",
      code: "not_configured",
    };
  }
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: clientId,
    device_code: deviceCode,
  });
  const res = await fetchImpl(authorityUrl("token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as TokenResponse;
  if (data.error === "authorization_pending") {
    return { status: "pending", slowDown: false };
  }
  // RFC 8628: the client must widen its polling interval, otherwise the
  // identity provider eventually kills the whole device-code flow.
  if (data.error === "slow_down") {
    return { status: "pending", slowDown: true };
  }
  if (!res.ok || !data.access_token) {
    const code = data.error || "unknown";
    return {
      status: "error",
      code,
      message:
        TERMINAL_ERROR_MESSAGES[code] ||
        data.error_description ||
        code ||
        "Anmeldung fehlgeschlagen.",
    };
  }
  const tokens: MicrosoftTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope,
  };
  writeTokens(tokens);
  return { status: "ok", tokens };
}

export async function refreshAccessToken(
  fetchImpl: typeof fetch = fetch,
): Promise<MicrosoftTokens | null> {
  const current = readTokens();
  if (!current?.refresh_token) return null;
  const clientId = getMicrosoftClientId();
  if (!clientId) return null;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: current.refresh_token,
    scope: SCOPES,
  });
  const res = await fetchImpl(authorityUrl("token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = (await res.json()) as TokenResponse;
  const tokens: MicrosoftTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? current.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope,
  };
  writeTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  let tokens = readTokens();
  if (isTokenValid(tokens)) return tokens!.access_token;
  tokens = await refreshAccessToken(fetchImpl);
  if (isTokenValid(tokens)) return tokens!.access_token;
  return null;
}
