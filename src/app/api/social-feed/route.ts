import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { decodeCursor } from "@/lib/data/cursor";
import { getSocialFeed } from "@/lib/data/social-posts";
import { logServerDataError } from "@/lib/logging/runtime";

export const dynamic = "force-dynamic";

/**
 * Bounded, cursor-driven public/community feed: at most 12 real posts per
 * request, no repeated sample content. Every request rechecks viewer scope.
 */
export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor && !decodeCursor(cursor)) {
    return NextResponse.json({ error: "Invalid cursor." }, {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const viewer = await getCurrentUser();
  try {
    const page = await getSocialFeed(viewer?.id, cursor ?? undefined);
    return NextResponse.json(page, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof Error && error.message.startsWith("Invalid cursor")) {
      return NextResponse.json({ error: "Invalid cursor." }, {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    logServerDataError({ error, operation: "social feed pagination", route: "/api/social-feed" });
    return NextResponse.json({ error: "Community feed temporarily unavailable." }, {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
