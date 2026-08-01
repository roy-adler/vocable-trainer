import { NextRequest, NextResponse } from "next/server";
import { groupMessagesByDay } from "@/lib/dates";
import { listChatMessages } from "@/lib/microsoft/graph";

type RouteContext = { params: Promise<{ chatId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { chatId } = await context.params;
    const decoded = decodeURIComponent(chatId);
    const day = request.nextUrl.searchParams.get("day");
    const messages = await listChatMessages(decoded);
    const buckets = groupMessagesByDay(messages);

    if (day) {
      const bucket = buckets.find((b) => b.dateKey === day);
      if (!bucket) {
        return NextResponse.json({ dateKey: day, count: 0, messages: [] });
      }
      return NextResponse.json({
        dateKey: bucket.dateKey,
        count: bucket.count,
        messages: bucket.messages.map((m) => ({
          id: m.id,
          sentAt: m.sentAt.toISOString(),
          from: m.from,
          body: m.body,
        })),
      });
    }

    return NextResponse.json(
      buckets.map((b) => ({ dateKey: b.dateKey, count: b.count })),
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nachrichten/Tage konnten nicht geladen werden.",
      },
      { status: 500 },
    );
  }
}
