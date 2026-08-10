import { useEffect, useRef, useState } from "react";
import { checkForCrisisLanguage } from "@/services/safeguardingService";

const DEBOUNCE_MS = 600;

/**
 * Debounced free-text safeguarding check — see safeguardingService.ts (fails
 * safe/closed outside __DEV__, so this is inert in any release build). Once
 * triggered, stays true for the lifetime of this hook instance even if the
 * text changes afterward — the banner it drives is persistent, not a
 * one-time dismiss, per hold-book's 2026-08-10 decision.
 */
export function useSafeguardingCheck(text: string): boolean {
  const [triggered, setTriggered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (triggered) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      void checkForCrisisLanguage(text).then((result) => {
        if (result.triggered) setTriggered(true);
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, triggered]);

  return triggered;
}
