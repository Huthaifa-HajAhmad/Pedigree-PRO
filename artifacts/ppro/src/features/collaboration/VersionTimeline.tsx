import { useState, useCallback, useRef, useEffect } from "react";
import { useListVersions, useRestoreVersion, queryKeys } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, RotateCcw, GitBranch, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PedigreeVersion } from "@workspace/api-client-react";

interface VersionTimelineProps {
  pedigreeId: number;
  currentCanvas: string; // JSON string of current canvas
  onRestore?: (canvasData: string) => void;
  onPreview?: (canvasData: string, versionId: number) => void;
  onRestoreRequest?: (versionId: number) => void;
}

/**
 * VersionTimeline — Horizontal scrubber showing all saved pedigree versions.
 *
 * Features:
 * - Thumbnail previews from version table
 * - Saver identity from local_profiles public_key
 * - Click to preview, double-click to restore
 * - Follow mode: auto-play through history
 */
export function VersionTimeline({ pedigreeId, currentCanvas, onRestore, onPreview, onRestoreRequest }: VersionTimelineProps) {
  const { data: versions, isLoading } = useListVersions(pedigreeId);
  const restoreVersion = useRestoreVersion();
  const queryClient = useQueryClient();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: versions?.length ?? 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120, // w-28 (112px) + gap (8px)
    horizontal: true,
  });

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (playIntervalRef.current !== null) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    };
  }, []);

  const handleSelect = useCallback((index: number, version: PedigreeVersion) => {
    setSelectedIndex(index);
    if (onPreview) {
      onPreview(version.canvas_data, version.id);
    }
  }, [onPreview]);

  const handleRestore = useCallback((version: PedigreeVersion) => {
    if (onRestoreRequest) {
      onRestoreRequest(version.id);
      return;
    }
    restoreVersion.mutate(
      { pedigreeId, versionId: version.id },
      {
        onSuccess: (pedigree) => {
          queryClient.invalidateQueries({ queryKey: queryKeys.pedigree(pedigreeId) });
          if (onRestore && pedigree.canvas_data) {
            onRestore(pedigree.canvas_data);
          }
        },
      }
    );
  }, [pedigreeId, restoreVersion, queryClient, onRestore, onRestoreRequest]);

  const handlePlay = useCallback(() => {
    if (!versions || versions.length === 0) return;
    setIsPlaying(true);
    let idx = selectedIndex ?? 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % versions.length;
      setSelectedIndex(idx);
      if (onPreview) {
        const v = versions[idx];
        if (v) onPreview(v.canvas_data, v.id);
      }
    }, 2000);
    playIntervalRef.current = interval;
  }, [versions, selectedIndex, onPreview]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    if (playIntervalRef.current !== null) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-20 border-t border-border bg-card">
        <div className="text-xs text-muted-foreground animate-pulse">Loading versions...</div>
      </div>
    );
  }

  if (!versions || versions.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 border-t border-border bg-card">
        <div className="text-xs text-muted-foreground">No saved versions yet</div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card px-3 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Version History</span>
          <span className="text-xs text-muted-foreground">({versions.length} versions)</span>
        </div>
        <div className="flex items-center gap-1">
          {isPlaying ? (
            <button type="button"
              onClick={handlePause}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Pause playback"
            >
              <Pause className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button type="button"
              onClick={handlePlay}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title="Play history"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="overflow-x-auto pb-1 scrollbar-thin">
        <div style={{ width: `${virtualizer.getTotalSize()}px`, position: "relative", height: 96 }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const version = versions[virtualItem.index];
            if (!version) return null;
            const index = virtualItem.index;
            const isSelected = selectedIndex === index;
            const date = (() => { try { return new Date(version.created_at).toLocaleDateString(); } catch { return "—"; } })();
            const time = (() => { try { return new Date(version.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } })();

            return (
              <div
                key={version.id}
                style={{ position: "absolute", left: virtualItem.start }}
                className={`w-28 cursor-pointer rounded border transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-border bg-background hover:border-muted-foreground/30"
                }`}
                onClick={() => handleSelect(index, version)}
                onDoubleClick={() => handleRestore(version)}
                title={`Double-click to restore\n${version.label ?? `Version ${version.version_number}`}\n${date} ${time}`}
              >
                {/* Thumbnail */}
                <div className="h-14 bg-muted/50 rounded-t flex items-center justify-center overflow-hidden">
                    {version.thumbnail ? (
                    <img
                      src={version.thumbnail}
                      alt={`Version ${version.version_number}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <Clock className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>

                {/* Info */}
                <div className="px-2 py-1.5">
                  <div className="text-xs font-medium truncate">
                    {version.label ?? `v${version.version_number}`}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <span>{date}</span>
                    <span>{time}</span>
                  </div>
                  {version.saver_key && (
                    <div className="text-xs text-primary/70 truncate font-mono">
                      {version.saver_key.slice(0, 8)}...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected version actions */}
      {(() => {
        if (selectedIndex === null) return null;
        const selVersion = versions[selectedIndex];
        if (!selVersion) return null;
        return (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
          <div className="text-xs text-muted-foreground">
            {selVersion.label ?? `Version ${selVersion.version_number}`}
            {" "}·{" "}
            {(() => { try { return new Date(selVersion.created_at).toLocaleString(); } catch { return "—"; } })()}
          </div>
          <div className="flex items-center gap-1">
            <button type="button"
              onClick={() => {
                if (selectedIndex > 0) {
                  const newIndex = selectedIndex - 1;
                  setSelectedIndex(newIndex);
                  if (onPreview) {
                    const v = versions[newIndex];
                    if (v) onPreview(v.canvas_data);
                  }
                }
              }}
              disabled={selectedIndex === 0}
              className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button type="button"
              onClick={() => handleRestore(selVersion)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Restore
            </button>
            <button type="button"
              onClick={() => {
                if (selectedIndex < versions.length - 1) {
                  const newIndex = selectedIndex + 1;
                  setSelectedIndex(newIndex);
                  if (onPreview) {
                    const v = versions[newIndex];
                    if (v) onPreview(v.canvas_data);
                  }
                }
              }}
              disabled={selectedIndex === versions.length - 1}
              className="p-1 rounded hover:bg-accent text-muted-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
