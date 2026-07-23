import crypto from "node:crypto";

import { getServerEnv } from "@/lib/env";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.floor(bytes / 1024))} KB`;
  return `${Math.floor(bytes / 1024 / 1024)} MB`;
}

export type StoredProfileImage = {
  key: string;
  url: string;
};

export function isProfileImageStorageConfigured() {
  const env = getServerEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY &&
      env.SUPABASE_AVATAR_BUCKET,
  );
}

export function validateProfileImageFile(file: File) {
  const env = getServerEnv();
  const mimeExtension = allowedTypes.get(file.type);
  const originalExtension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!mimeExtension || !allowedExtensions.has(originalExtension)) {
    return {
      error: "Use a JPEG, PNG, or WebP image.",
    };
  }

  if (file.size <= 0) {
    return { error: "Choose a non-empty image file." };
  }

  if (file.size > env.UPLOAD_MAX_BYTES) {
    return {
      error: `Profile images must be ${formatBytes(env.UPLOAD_MAX_BYTES)} or smaller.`,
    };
  }

  return { extension: mimeExtension };
}

export async function uploadProfileImage({
  extension,
  file,
  userId,
}: {
  extension: string;
  file: File;
  userId: string;
}): Promise<StoredProfileImage> {
  const env = getServerEnv();
  if (!isProfileImageStorageConfigured()) {
    throw new Error("Profile image storage is not configured.");
  }
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Profile image storage is not configured.");
  }

  const key = `avatars/${userId}/${crypto.randomUUID()}.${extension}`;
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const bucket = encodeURIComponent(env.SUPABASE_AVATAR_BUCKET);
  const objectPath = key.split("/").map(encodeURIComponent).join("/");
  const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    body: await file.arrayBuffer(),
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "cache-control": "3600",
      "content-type": file.type,
      "x-upsert": "false",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Profile image upload failed.");
  }

  return {
    key,
    url: `${baseUrl}/storage/v1/object/public/${bucket}/${objectPath}`,
  };
}

export async function deleteProfileImage(key: string | null | undefined) {
  if (!key || !isProfileImageStorageConfigured()) return;

  const env = getServerEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return;

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const bucket = encodeURIComponent(env.SUPABASE_AVATAR_BUCKET);

  await fetch(`${baseUrl}/storage/v1/object/${bucket}`, {
    body: JSON.stringify({ prefixes: [key] }),
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
    },
    method: "DELETE",
  }).catch(() => undefined);
}
