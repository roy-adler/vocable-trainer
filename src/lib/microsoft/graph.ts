import { getValidAccessToken } from "./auth";
import type { TimedMessage } from "../dates";

const GRAPH = "https://graph.microsoft.com/v1.0";

export type GraphChat = {
  id: string;
  topic: string | null;
  chatType: string;
  lastMessagePreview?: string;
};

async function graphFetch(
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const token = await getValidAccessToken(fetchImpl);
  if (!token) {
    throw new Error("Nicht bei Microsoft angemeldet.");
  }
  return fetchImpl(`${GRAPH}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export async function listChats(
  fetchImpl: typeof fetch = fetch,
): Promise<GraphChat[]> {
  let res = await graphFetch("/me/chats?$top=50", fetchImpl);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Chats konnten nicht geladen werden (${res.status}): ${text.slice(0, 180)}`,
    );
  }
  const data = (await res.json()) as {
    value?: Array<{
      id: string;
      topic?: string | null;
      chatType?: string;
      lastMessagePreview?: { body?: { content?: string } };
    }>;
  };
  return (data.value ?? []).map((c) => ({
    id: c.id,
    topic: c.topic ?? null,
    chatType: c.chatType ?? "unknown",
    lastMessagePreview: c.lastMessagePreview?.body?.content,
  }));
}

type GraphMessage = {
  id: string;
  createdDateTime?: string;
  from?: { user?: { displayName?: string } };
  body?: { content?: string; contentType?: string };
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

export async function listChatMessages(
  chatId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TimedMessage[]> {
  const encoded = encodeURIComponent(chatId);
  const messages: TimedMessage[] = [];
  let url: string | null =
    `${GRAPH}/me/chats/${encoded}/messages?$top=50&$orderby=createdDateTime desc`;

  // Paginate a few pages max to keep v1 bounded
  for (let page = 0; page < 10 && url; page++) {
    const token = await getValidAccessToken(fetchImpl);
    if (!token) throw new Error("Nicht bei Microsoft angemeldet.");
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Nachrichten konnten nicht geladen werden (${res.status}): ${text.slice(0, 180)}`,
      );
    }
    const data = (await res.json()) as {
      value?: GraphMessage[];
      "@odata.nextLink"?: string;
    };
    for (const m of data.value ?? []) {
      const raw = m.body?.content ?? "";
      const body =
        m.body?.contentType === "html" ? stripHtml(raw) : raw.trim();
      if (!body) continue;
      if (!m.createdDateTime) continue;
      messages.push({
        id: m.id,
        sentAt: new Date(m.createdDateTime),
        body,
        from: m.from?.user?.displayName,
      });
    }
    url = data["@odata.nextLink"] ?? null;
  }

  return messages;
}
