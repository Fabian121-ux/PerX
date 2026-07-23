"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.floor(bytes / 1024))} KB`;
  return `${Math.floor(bytes / 1024 / 1024)} MB`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function ProfileImageUploader({
  initialImageUrl,
  maxBytes,
  name,
  storageEnabled,
}: {
  initialImageUrl?: string;
  maxBytes: number;
  name: string;
  storageEnabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [previewUrl, setPreviewUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeImage = previewUrl || imageUrl;

  function upload(file: File) {
    setError("");

    if (!storageEnabled) {
      setError("Profile image storage is not configured for this environment.");
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      setError("Use a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > maxBytes) {
      setError(`Profile images must be ${formatBytes(maxBytes)} or smaller.`);
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setBusy(true);
    setProgress(0);

    const body = new FormData();
    body.set("image", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/profile/image");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      setBusy(false);
      URL.revokeObjectURL(localPreview);
      try {
        const response = JSON.parse(request.responseText) as {
          error?: string;
          imageUrl?: string;
        };
        if (request.status >= 200 && request.status < 300 && response.imageUrl) {
          setImageUrl(response.imageUrl);
          setPreviewUrl("");
          setProgress(100);
          return;
        }
        setPreviewUrl("");
        setError(response.error ?? "Profile image upload failed.");
      } catch {
        setPreviewUrl("");
        setError("Profile image upload failed.");
      }
    };
    request.onerror = () => {
      setBusy(false);
      setPreviewUrl("");
      URL.revokeObjectURL(localPreview);
      setError("Profile image upload failed.");
    };
    request.send(body);
  }

  async function removeImage() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/profile/image", { method: "DELETE" });
    setBusy(false);
    if (response.ok) {
      setImageUrl("");
      setPreviewUrl("");
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError("Could not remove the profile image.");
  }

  return (
    <div className="grid gap-3 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
      <input name="profileImageUrl" type="hidden" value={imageUrl} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[color:var(--px-primary)] text-xl font-black text-white ring-1 ring-[color:var(--px-border)]">
          {activeImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${name} profile preview`}
              className="h-full w-full object-cover"
              onError={() => {
                setImageUrl("");
                setPreviewUrl("");
              }}
              src={activeImage}
            />
          ) : (
            initials(name)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-sm font-semibold text-[color:var(--px-text)]" htmlFor="profile-image-file">
            Profile image
          </label>
          <p className="mt-1 text-xs leading-5 text-[color:var(--px-text-muted)]">
            JPEG, PNG, or WebP. Stored as your PerX profile avatar.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy || !storageEnabled}
              id="profile-image-file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) upload(file);
              }}
              ref={inputRef}
              type="file"
            />
            <Button
              disabled={busy || !storageEnabled}
              onClick={() => inputRef.current?.click()}
              type="button"
              variant="secondary"
            >
              <UploadCloud aria-hidden className="mr-2" size={16} />
              Upload
            </Button>
            {imageUrl ? (
              <Button disabled={busy} onClick={removeImage} type="button" variant="secondary">
                <Trash2 aria-hidden className="mr-2" size={16} />
                Remove
              </Button>
            ) : null}
          </div>
          {!storageEnabled ? (
            <p className="mt-2 text-xs font-semibold text-[color:var(--px-warning)]">
              Avatar storage is not configured in this environment.
            </p>
          ) : null}
        </div>
        <Camera aria-hidden className="hidden text-[color:var(--px-text-muted)] sm:block" size={22} />
      </div>
      {busy ? (
        <div aria-label="Upload progress" className="h-2 overflow-hidden rounded-full bg-[color:var(--px-muted)]">
          <div className="h-full bg-[color:var(--px-primary)] transition-all" style={{ width: `${progress}%` }} />
        </div>
      ) : null}
      {error ? <p className="text-sm font-semibold text-[color:var(--px-error)]">{error}</p> : null}
    </div>
  );
}
