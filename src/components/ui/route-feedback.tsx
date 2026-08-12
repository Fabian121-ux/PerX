"use client";

import { useEffect, useRef } from "react";

import { useToast, type ToastInput } from "@/components/ui/feedback-provider";

export function RouteFeedback({ feedback }: { feedback?: ToastInput | null }) {
  const toast = useToast();
  const shownKeyRef = useRef("");
  const key = feedback
    ? `${feedback.tone ?? "info"}:${feedback.title}:${feedback.description ?? ""}`
    : "";

  useEffect(() => {
    if (!feedback || !key) {
      shownKeyRef.current = "";
      return;
    }
    if (shownKeyRef.current === key) return;
    shownKeyRef.current = key;
    toast(feedback);
  }, [feedback, key, toast]);

  return null;
}
