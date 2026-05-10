import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { UseMutateFunction } from "@tanstack/react-query";
import { queryKeys } from "@workspace/api-client-react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";
import { parseCanvas } from "@/features/pedigree-editor/utils/helpers";
import { generateThumbnail } from "@/lib/generate-thumbnail";

interface UseVersionManagementOptions {
  id: number;
  canvas: CanvasData;
  setCanvas: (canvas: CanvasData) => void;
  setSessionLabel: (label: string) => void;
  setShowSaveModal: (show: boolean) => void;
  setShowVersions: (show: boolean) => void;
  saveVersion: UseMutateFunction<unknown, Error, { pedigreeId: number; input: Record<string, unknown> }, unknown>;
  restoreVersion: UseMutateFunction<{ canvas_data: string }, Error, { pedigreeId: number; versionId: number }, unknown>;
}

export function useVersionManagement({
  id,
  canvas,
  setCanvas,
  setSessionLabel,
  setShowSaveModal,
  setShowVersions,
  saveVersion,
  restoreVersion,
}: UseVersionManagementOptions) {
  const queryClient = useQueryClient();

  const handleSaveVersion = useCallback(() => {
    const auto = `Session · ${canvas.nodes.length} node${canvas.nodes.length !== 1 ? "s" : ""} · ${new Date().toLocaleDateString()}`;
    setSessionLabel(auto);
    setShowSaveModal(true);
  }, [canvas.nodes.length, setSessionLabel, setShowSaveModal]);

  const commitSaveVersion = useCallback(() => {
    const thumb = generateThumbnail(canvas);
    saveVersion(
      { pedigreeId: id, input: { canvas_data: JSON.stringify(canvas), label: "" /* sessionLabel managed externally */, thumbnail: thumb, saver_key: "" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.versions(id) });
          setShowSaveModal(false);
        },
      }
    );
  }, [id, canvas, saveVersion, queryClient, setShowSaveModal]);

  const handleDeleteVersion = useCallback((versionId: number) => {
    if (!confirm("Delete this saved session? This cannot be undone.\n\nNote: Version deletion via the API will be available in a future update.")) return;
    alert("Version deletion is not yet available in this build. Coming in v0.2.");
  }, []);

  const handleRestoreVersion = useCallback((versionId: number) => {
    if (!confirm("Restore this version? Current canvas will be replaced.")) return;
    restoreVersion(
      { pedigreeId: id, versionId },
      {
        onSuccess: (data) => {
          setCanvas(parseCanvas(data.canvas_data));
          queryClient.invalidateQueries({ queryKey: queryKeys.pedigree(id) });
          setShowVersions(false);
        },
      }
    );
  }, [id, restoreVersion, setCanvas, queryClient, setShowVersions]);

  return { handleSaveVersion, commitSaveVersion, handleDeleteVersion, handleRestoreVersion };
}