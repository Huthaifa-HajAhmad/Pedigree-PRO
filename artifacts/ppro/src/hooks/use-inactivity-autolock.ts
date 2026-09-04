import { useState, useEffect, useCallback, useRef } from "react";

const AUTO_LOCK_PREF_KEY = "ppro:inactivity_autolock_minutes";

export function useInactivityAutoLock() {
  const [lockMinutes, setLockMinutes] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(AUTO_LOCK_PREF_KEY);
      return stored ? parseInt(stored, 10) : 0; // 0 = disabled
    } catch {
      return 0;
    }
  });

  const [isLocked, setIsLocked] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const unlock = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsLocked(false);
  }, []);

  const updateTimeout = useCallback((minutes: number) => {
    setLockMinutes(minutes);
    try {
      localStorage.setItem(AUTO_LOCK_PREF_KEY, minutes.toString());
    } catch {}
  }, []);

  useEffect(() => {
    if (lockMinutes <= 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const timeoutMs = lockMinutes * 60 * 1000;

    const onActivity = () => {
      if (!isLocked) {
        lastActivityRef.current = Date.now();
      }
    };

    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    window.addEventListener("touchstart", onActivity, { passive: true });
    window.addEventListener("pointerdown", onActivity, { passive: true });

    timerRef.current = setInterval(() => {
      if (!isLocked && Date.now() - lastActivityRef.current >= timeoutMs) {
        setIsLocked(true);
      }
    }, 10_000);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockMinutes, isLocked]);

  return {
    isLocked,
    lockMinutes,
    unlock,
    resetActivity,
    updateTimeout,
  };
}
