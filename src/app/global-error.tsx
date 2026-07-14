"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error Boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-16 text-center text-zinc-900">
          <div className="rounded-full bg-red-100 p-4 text-red-600">
            <AlertCircle size={32} />
          </div>
          <h1 className="mt-6 text-3xl font-black">
            System Unavailable
          </h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-zinc-600">
            A critical system error has occurred. Our team has been notified.
          </p>
          <div className="mt-8">
            <button
              onClick={() => reset()}
              className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
            >
              Restart Session
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
