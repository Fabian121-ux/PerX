import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { getResolvedDataMode } from "@/lib/env";
import { getPushPublicKey } from "@/lib/push/web-push";

const categories = ["messages", "connections", "deals", "opportunities", "system"] as const;
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(80).max(200),
    auth: z.string().min(16).max(100),
  }),
  categories: z.array(z.enum(categories)).max(categories.length).optional(),
});

const allowedHosts = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
]);

function validEndpoint(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && allowedHosts.has(url.hostname);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (getResolvedDataMode() === "mock") {
    return NextResponse.json({ enabled: false, publicKey: null, supported: false });
  }
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  const [publicKey, subscription] = await Promise.all([
    Promise.resolve(getPushPublicKey()),
    endpoint
      ? getPrisma().pushSubscription.findFirst({
          select: { categories: true },
          where: { endpoint, userId: user.id },
        })
      : getPrisma().pushSubscription.findFirst({
          select: { categories: true },
          where: { userId: user.id },
        }),
  ]);
  return NextResponse.json({
    categories: subscription?.categories ?? [...categories],
    enabled: Boolean(subscription),
    publicKey,
    supported: Boolean(publicKey),
  });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (getResolvedDataMode() === "mock") {
    return NextResponse.json({ error: "Push notifications require database mode." }, { status: 503 });
  }
  if (!getPushPublicKey()) {
    return NextResponse.json({ error: "Push notifications are not configured yet." }, { status: 503 });
  }
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !validEndpoint(parsed.data?.endpoint ?? "")) {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  const existing = await getPrisma().pushSubscription.findUnique({
    where: { endpoint: parsed.data.endpoint },
    select: { id: true, userId: true },
  });
  if (existing && existing.userId !== user.id) {
    return NextResponse.json({ error: "This device subscription is already linked to another account." }, { status: 409 });
  }
  const categoriesValue = parsed.data.categories
    ? [...new Set(parsed.data.categories)]
    : [...categories];
  await getPrisma().pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      auth: parsed.data.keys.auth,
      categories: categoriesValue,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      userId: user.id,
    },
    update: {
      auth: parsed.data.keys.auth,
      categories: categoriesValue,
      p256dh: parsed.data.keys.p256dh,
    },
  });
  return NextResponse.json({ enabled: true });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (getResolvedDataMode() === "mock") {
    return NextResponse.json({ enabled: false });
  }
  const body = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string" || body.endpoint.length > 2048) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }
  await getPrisma().pushSubscription.deleteMany({
    where: { endpoint: body.endpoint, userId: user.id },
  });
  return NextResponse.json({ enabled: false });
}
