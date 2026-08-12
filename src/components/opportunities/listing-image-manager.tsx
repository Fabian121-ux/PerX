"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useConfirm,
  useToast,
} from "@/components/ui/feedback-provider";

type ListingImage = {
  id: string;
  url: string;
  isCover: boolean;
};

export function ListingImageManager({
  images,
  maxBytes,
  opportunityId,
  storageEnabled,
}: {
  images: ListingImage[];
  maxBytes: number;
  opportunityId: string;
  storageEnabled: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");

  const maxSizeLabel = useMemo(() => {
    if (maxBytes < 1024 * 1024) return `${Math.max(1, Math.floor(maxBytes / 1024))} KB`;
    return `${Math.floor(maxBytes / 1024 / 1024)} MB`;
  }, [maxBytes]);

  const upload = async () => {
    const file = inputRef.current?.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setError("");

    const formData = new FormData();
    formData.set("image", file);
    formData.set("makeCover", images.length ? "false" : "true");

    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/images`, {
        body: formData,
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Upload failed. Try again.");
        return;
      }
      setPreview("");
      if (inputRef.current) inputRef.current.value = "";
      toast({ title: "Image uploaded", tone: "success" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const selectCover = async (imageId: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}/images`, {
        body: JSON.stringify({ imageId }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Could not select cover image.");
        return;
      }
      toast({ title: "Cover image updated", tone: "success" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (imageId: string) => {
    if (busy) return;
    const approved = await confirm({
      confirmLabel: "Remove image",
      description:
        "The image will be removed from this listing. This cannot be undone.",
      title: "Remove listing image?",
      tone: "danger",
    });
    if (!approved) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/opportunities/${opportunityId}/images?imageId=${encodeURIComponent(imageId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Could not remove image.");
        return;
      }
      toast({ title: "Image removed", tone: "success" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-4 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface-soft)] p-4">
      <div>
        <h2 className="font-bold text-[color:var(--px-text)]">Listing images</h2>
        <p className="mt-1 text-sm text-[color:var(--px-text-muted)]">
          Upload JPEG, PNG, or WebP images up to {maxSizeLabel}. Property listings need at least one image and a cover before review.
        </p>
      </div>

      {storageEnabled ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-2 text-sm font-semibold text-[color:var(--px-text)]">
            <span>Image file</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="min-h-11 rounded-[var(--px-radius-sm)] border border-[color:var(--px-border)] bg-[color:var(--px-surface)] px-3 py-2 text-sm"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : "");
              }}
              ref={inputRef}
              type="file"
            />
          </label>
          <Button disabled={busy} onClick={upload} type="button">
            {busy ? <Loader2 aria-hidden className="mr-2 animate-spin" size={16} /> : <ImagePlus aria-hidden className="mr-2" size={16} />}
            Upload
          </Button>
        </div>
      ) : (
        <p className="rounded-[var(--px-radius-sm)] bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Listing image storage is not configured, so uploads are unavailable.
        </p>
      )}

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="Selected listing preview" className="h-40 w-full rounded-[var(--px-radius-sm)] object-cover" src={preview} />
      ) : null}

      {error ? (
        <p className="rounded-[var(--px-radius-sm)] bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      ) : null}

      {images.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <div className="overflow-hidden rounded-[var(--px-radius-sm)] bg-[color:var(--px-surface)] ring-1 ring-[color:var(--px-border)]" key={image.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Listing image" className="h-36 w-full object-cover" src={image.url} />
              <div className="flex flex-wrap gap-2 p-3">
                <Button
                  disabled={busy || image.isCover}
                  onClick={() => selectCover(image.id)}
                  size="sm"
                  type="button"
                  variant={image.isCover ? "primary" : "secondary"}
                >
                  <Star aria-hidden className="mr-1.5" size={14} />
                  {image.isCover ? "Cover" : "Set cover"}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => remove(image.id)}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  <Trash2 aria-hidden className="mr-1.5" size={14} />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
