import crypto from "node:crypto";

import { getServerEnv } from "@/lib/env";

const maxChatImageBytes = 5 * 1024 * 1024;
const imageTypes = {
  "image/jpeg": { extension: "jpg", extensions: ["jpg", "jpeg"] },
  "image/png": { extension: "png", extensions: ["png"] },
  "image/webp": { extension: "webp", extensions: ["webp"] },
} as const;
type ChatImageType = keyof typeof imageTypes;

export function isMessageImageStorageConfigured() {
  const env = getServerEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
    env.SUPABASE_SERVICE_ROLE_KEY &&
    env.SUPABASE_MESSAGE_BUCKET,
  );
}

export async function validateMessageImage(file: File) {
  const kind = imageTypes[file.type as ChatImageType];
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!kind || !(kind.extensions as readonly string[]).includes(extension)) {
    return { error: "Choose a JPEG, PNG or WebP photo." };
  }
  if (file.size <= 0 || file.size > maxChatImageBytes) {
    return { error: "Photos must be between 1 byte and 5 MB." };
  }
  const data = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const jpeg = data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const png = data.length >= 8 && [137,80,78,71,13,10,26,10].every((b,i) => data[i] === b);
  const webp = data.length >= 12 &&
    String.fromCharCode(...data.slice(0,4)) === "RIFF" &&
    String.fromCharCode(...data.slice(8,12)) === "WEBP";
  if ((file.type === "image/jpeg" && !jpeg) ||
      (file.type === "image/png" && !png) ||
      (file.type === "image/webp" && !webp)) {
    return { error: "This file does not contain a valid supported image header." };
  }
  return { extension: kind.extension };
}

function storageSettings() {
  const env = getServerEnv();
  if (!isMessageImageStorageConfigured() || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Private message image storage is not configured.");
  }
  return {
    base: env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ""),
    bucket: encodeURIComponent(env.SUPABASE_MESSAGE_BUCKET),
    key: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function storagePath(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Uploaded blobs are never published as unauthenticated Storage URLs. */
export async function uploadMessageImage({
  file,
  conversationId,
  userId,
  extension,
}: {
  file: File;
  conversationId: string;
  userId: string;
  extension: string;
}) {
  const env = storageSettings();
  const key = `messages/${conversationId}/${userId}/${crypto.randomUUID()}.${extension}`;
  const response = await fetch(`${env.base}/storage/v1/object/${env.bucket}/${storagePath(key)}`, {
    method: "POST",
    body: await file.arrayBuffer(),
    headers: {
      apikey: env.key,
      authorization: `Bearer ${env.key}`,
      "content-type": file.type,
      "cache-control": "0",
      "x-upsert": "false",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Private photo upload failed.");
  return key;
}

export async function downloadMessageImage(key: string) {
  const env = storageSettings();
  const response = await fetch(
    `${env.base}/storage/v1/object/authenticated/${env.bucket}/${storagePath(key)}`,
    {
      method: "GET",
      headers: { apikey: env.key, authorization: `Bearer ${env.key}` },
      cache: "no-store",
    },
  );
  if (!response.ok || !response.body) throw new Error("Private photo unavailable.");
  return response;
}

export async function deleteMessageImage(key: string) {
  if (!isMessageImageStorageConfigured()) return;
  const env = storageSettings();
  await fetch(`${env.base}/storage/v1/object/${env.bucket}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [key] }),
    headers: {
      apikey: env.key,
      authorization: `Bearer ${env.key}`,
      "content-type": "application/json",
    },
    cache: "no-store",
  }).catch(() => undefined);
}

export function isValidStoredMessageImageKey(key: string, conversationId: string) {
  return new RegExp(`^messages/${conversationId}/[a-z0-9]+/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(key);
}
