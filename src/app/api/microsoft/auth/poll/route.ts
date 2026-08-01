import { NextRequest, NextResponse } from "next/server";
import { pollDeviceCode } from "@/lib/microsoft/auth";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { deviceCode?: string };
    if (!body.deviceCode) {
      return NextResponse.json({ error: "deviceCode fehlt." }, { status: 400 });
    }
    const result = await pollDeviceCode(body.deviceCode);
    if (result.status === "pending") {
      return NextResponse.json({ status: "pending", slowDown: result.slowDown });
    }
    if (result.status === "error") {
      console.error("Microsoft device-code poll failed:", result.code, result.message);
      return NextResponse.json(
        { status: "error", error: result.message, code: result.code },
        { status: 400 },
      );
    }
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Abfrage der Anmeldung fehlgeschlagen." },
      { status: 500 },
    );
  }
}
