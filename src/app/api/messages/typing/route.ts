import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { hasConversationRealtimeAccess } from "@/lib/messages/realtime";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const typingSchema = z.object({
  conversationId: z.string().cuid(),
  isTyping: z.boolean(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = typingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid typing update." }, { status: 400 });
  }

  const { conversationId, isTyping } = parsed.data;
  if (!(await hasConversationRealtimeAccess(conversationId, user.id))) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: "Typing updates are unavailable." }, { status: 503 });
  }

  try {
    const endpoint = new URL(
      "/realtime/v1/api/broadcast?private=true",
      env.NEXT_PUBLIC_SUPABASE_URL,
    );
    const response = await fetch(endpoint.toString(), {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `conversation:${conversationId}:typing`,
            event: "typing",
            payload: {
              conversationId,
              isTyping,
              name: (user.name?.trim() || user.username || "Participant").slice(0, 80),
              userId: user.id,
            },
          },
        ],
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return Response.json({ error: "Typing updates are unavailable." }, { status: 503 });
    }
  } catch {
    return Response.json({ error: "Typing updates are unavailable." }, { status: 503 });
  }

  return Response.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
