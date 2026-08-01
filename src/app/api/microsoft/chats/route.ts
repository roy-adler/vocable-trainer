import { NextResponse } from "next/server";
import { listChats } from "@/lib/microsoft/graph";

export async function GET() {
  try {
    const chats = await listChats();
    return NextResponse.json(chats);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Chats konnten nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
