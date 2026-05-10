import { useState, useCallback, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Clock, X } from "lucide-react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";
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
        onPreview(versions[next].canvas_data);
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
    onChangeIndex(next);
    onPreview(versions[next].canvas_data);
  }, [currentIndex, versions, onChangeIndex, onPreview]);

  const stepForward = useCallback(() => {
    const next = Math.min(versions.length - 1, currentIndex + 1);
    onChangeIndex(next);
    onPreview(versions[next].canvas_data);
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
          <span className="text-[10px] text-muted-foreground">
            {currentIndex + 1} / {versions.length}
          </span>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors ml-2">
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
          <div className="text-[10px] text-muted-foreground">
            {new Date(currentVersion.created_at).toLocaleString()}
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
          <button
            onClick={stepBack}
            disabled={currentIndex === 0}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 transition-colors"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {isPlaying ? (
            <button
              onClick={pause}
              className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Pause className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={play}
              className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={stepForward}
            disabled={currentIndex === versions.length - 1}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          {[1000, 2000, 4000].map((ms) => (
            <button
              key={ms}
              onClick={() => {
                setSpeed(ms);
                if (isPlaying) {
                  pause();
                  setTimeout(() => play(), 50);
                }
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                speed === ms
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {ms / 1000}s
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
