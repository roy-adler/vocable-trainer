import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMicrosoftTenant, pollDeviceCode, startDeviceCode } from "./auth";

const originalEnv = { ...process.env };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  process.env.MICROSOFT_CLIENT_ID = "test-client-id";
  delete process.env.MICROSOFT_TENANT;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("getMicrosoftTenant", () => {
  it("defaults to common", () => {
    expect(getMicrosoftTenant()).toBe("common");
  });

  it("uses the configured tenant", () => {
    process.env.MICROSOFT_TENANT = "consumers";
    expect(getMicrosoftTenant()).toBe("consumers");
  });
});

describe("startDeviceCode", () => {
  it("requests the code from the configured authority", async () => {
    process.env.MICROSOFT_TENANT = "consumers";
    let calledUrl = "";
    const fetchImpl = (async (url: string) => {
      calledUrl = String(url);
      return jsonResponse({
        device_code: "dev",
        user_code: "ABC123",
        verification_uri: "https://microsoft.com/devicelogin",
        expires_in: 900,
        interval: 5,
        message: "…",
      });
    }) as unknown as typeof fetch;

    const device = await startDeviceCode(fetchImpl);
    expect(calledUrl).toBe(
      "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode",
    );
    expect(device.user_code).toBe("ABC123");
  });

  it("includes the Microsoft error body when the request fails", async () => {
    const fetchImpl = (async () =>
      new Response("AADSTS700016: application not found", {
        status: 400,
      })) as unknown as typeof fetch;

    await expect(startDeviceCode(fetchImpl)).rejects.toThrow(/AADSTS700016/);
  });
});

describe("pollDeviceCode", () => {
  it("reports authorization_pending without slow down", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ error: "authorization_pending" }, 400)) as unknown as typeof fetch;

    expect(await pollDeviceCode("dev", fetchImpl)).toEqual({
      status: "pending",
      slowDown: false,
    });
  });

  it("flags slow_down so the caller can widen its interval", async () => {
    const fetchImpl = (async () =>
      jsonResponse({ error: "slow_down" }, 400)) as unknown as typeof fetch;

    expect(await pollDeviceCode("dev", fetchImpl)).toEqual({
      status: "pending",
      slowDown: true,
    });
  });

  it("returns a readable message for an expired code", async () => {
    const fetchImpl = (async () =>
      jsonResponse(
        { error: "expired_token", error_description: "AADSTS70020" },
        400,
      )) as unknown as typeof fetch;

    const result = await pollDeviceCode("dev", fetchImpl);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.code).toBe("expired_token");
      expect(result.message).toMatch(/neuen Code/);
    }
  });

  it("errors when the client id is missing", async () => {
    delete process.env.MICROSOFT_CLIENT_ID;
    const result = await pollDeviceCode("dev");
    expect(result).toEqual({
      status: "error",
      code: "not_configured",
      message: "MICROSOFT_CLIENT_ID fehlt.",
    });
  });
});
