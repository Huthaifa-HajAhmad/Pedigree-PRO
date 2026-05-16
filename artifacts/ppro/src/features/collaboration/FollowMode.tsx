import { useState, useCallback, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PedigreeVersion } from "@workspace/api-client-react";

interface FollowModeProps {
  versions: PedigreeVersion[];
  currentIndex: number;
  onChangeIndex: (index: number | ((prev: number) => number)) => void;
  onPreview: (canvasData: string) => void;
  onClose: () => void;
}

/**
 * FollowMode — Animated history playback of pedigree versions.
 *
 * Auto-plays through the version timeline with configurable speed,
 * showing change annotations and allowing pause/rewind/forward.
 */
export function FollowMode({ versions, currentIndex, onChangeIndex, onPreview, onClose }: FollowModeProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(2000); // ms between versions
  const [intervalId, setIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);

  const play = useCallback(() => {
    if (versions.length === 0) return;
    setIsPlaying(true);
    const id = setInterval(() => {
      onChangeIndex((prev) => {
        const next = (prev + 1) % versions.length;
        const v = versions[next];
        if (v) onPreview(v.canvas_data);
        return next;
      });
    }, speed);
    setIntervalId(id);
  }, [versions, speed, onChangeIndex, onPreview]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [intervalId]);

  const stepBack = useCallback(() => {
    const next = Math.max(0, currentIndex - 1);
    const v = versions[next];
    if (v) onPreview(v.canvas_data);
    onChangeIndex(next);
  }, [currentIndex, versions, onChangeIndex, onPreview]);

  const stepForward = useCallback(() => {
    const next = Math.min(versions.length - 1, currentIndex + 1);
    const v = versions[next];
    if (v) onPreview(v.canvas_data);
    onChangeIndex(next);
  }, [currentIndex, versions, onChangeIndex, onPreview]);

  useEffect(() => {
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalId]);

  const currentVersion = versions[currentIndex];
  const progress = versions.length > 0 ? ((currentIndex + 1) / versions.length) * 100 : 0;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[420px] border border-border rounded-lg shadow-xl bg-card/95 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium">Follow History</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {versions.length}
          </span>
          <button type="button" aria-label="Close follow mode" onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors ml-2">
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Version info */}
      {currentVersion && (
        <div className="px-3 py-1.5 border-b border-border/50">
          <div className="text-xs font-medium truncate">
            {currentVersion.label ?? `Version ${currentVersion.version_number}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {(() => { try { return new Date(currentVersion.created_at).toLocaleString(); } catch { return "—"; } })()}
            {currentVersion.saver_key && (
              <span className="ml-2 font-mono">by {currentVersion.saver_key.slice(0, 8)}...</span>
            )}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="px-3 py-1.5">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={stepBack}
            disabled={currentIndex === 0}
            className="h-8 w-8"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </Button>

          {isPlaying ? (
            <Button
              variant="outline"
              size="icon"
              onClick={pause}
              className="h-8 w-8"
            >
              <Pause className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              onClick={play}
              className="h-8 w-8"
            >
              <Play className="w-4 h-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={stepForward}
            disabled={currentIndex === versions.length - 1}
            className="h-8 w-8"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          {[1000, 2000, 4000].map((ms) => (
            <Button
              key={ms}
              variant={speed === ms ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setSpeed(ms);
                if (isPlaying) {
                  pause();
                  setTimeout(() => play(), 50);
                }
              }}
              className="text-xs h-6 px-1.5"
            >
              {ms / 1000}s
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
