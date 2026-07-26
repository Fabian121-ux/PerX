import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getUnreadCounts } from "@/lib/data/unread-counts";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ messages: 0, notifications: 0 }, { status: 401 });

  return NextResponse.json(await getUnreadCounts(user.id));
}
