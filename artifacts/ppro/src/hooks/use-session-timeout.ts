import { useState, useEffect, useCallback, useRef } from "react";

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;

interface SessionLockState {
  isLocked: boolean;
  isWarning: boolean;
  remainingSeconds: number;
  extendSession: () => void;
  lockNow: () => void;
  unlock: () => void;
}

export function useSessionTimeout(timeoutMs: number = DEFAULT_TIMEOUT_MS): SessionLockState {
  const [isLocked, setIsLocked] = useState(false);
  const [isWarning, setIsWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(Math.floor(timeoutMs / 1000));
  const lastActivity = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = useCallback(() => {
    lastActivity.current = Date.now();
    setIsWarning(false);
    setRemainingSeconds(Math.floor(timeoutMs / 1000));
  }, [timeoutMs]);

  const lockNow = useCallback(() => {
    setIsLocked(true);
    setIsWarning(false);
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    setIsWarning(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"] as const;
    const handleActivity = () => {
      lastActivity.current = Date.now();
      setIsWarning(false);
    };

    for (const event of events) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivity.current;
      const remaining = Math.max(0, timeoutMs - elapsed);
      setRemainingSeconds(Math.floor(remaining / 1000));

      if (remaining <= WARNING_BEFORE_MS && remaining > 0) {
        setIsWarning(true);
      }
      if (remaining <= 0) {
        setIsLocked(true);
        setIsWarning(false);
      }
    }, 1000);

    return () => {
      for (const event of events) {
        document.removeEventListener(event, handleActivity);
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeoutMs]);

  return {
    isLocked,
    isWarning,
    remainingSeconds,
    extendSession: resetTimer,
    lockNow,
    unlock,
  };
}