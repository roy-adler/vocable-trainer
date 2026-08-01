import { NextResponse } from "next/server";
import {
  clearTokens,
  getValidAccessToken,
  isMicrosoftConfigured,
  readTokens,
  startDeviceCode,
} from "@/lib/microsoft/auth";

export async function GET() {
  const configured = isMicrosoftConfigured();
  const token = configured ? await getValidAccessToken() : null;
  return NextResponse.json({
    configured,
    connected: Boolean(token),
    hasRefreshToken: Boolean(readTokens()?.refresh_token),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action === "logout") {
    clearTokens();
    return NextResponse.json({ ok: true });
  }
  if (body.action === "start") {
    if (!isMicrosoftConfigured()) {
      return NextResponse.json(
        {
          error:
            "MICROSOFT_CLIENT_ID fehlt. Bitte in der Umgebung setzen (Azure App-Registrierung).",
        },
        { status: 400 },
      );
    }
    try {
      const device = await startDeviceCode();
      return NextResponse.json({
        deviceCode: device.device_code,
        userCode: device.user_code,
        verificationUri: device.verification_uri,
        message: device.message,
        interval: device.interval,
        expiresIn: device.expires_in,
      });
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Device-Code fehlgeschlagen." },
        { status: 500 },
      );
    }
  }
  return NextResponse.json({ error: "Unbekannte Aktion." }, { status: 400 });
}
