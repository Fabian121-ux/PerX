"use client";

import { useRouter } from "next/navigation";

export function RetryButton() {
  const router = useRouter();
  
  return (
    <div className="mt-3 block">
      <button
        onClick={() => router.refresh()}
        className="font-semibold underline hover:no-underline"
        type="button"
      >
        Retry connection
      </button>
    </div>
  );
}
