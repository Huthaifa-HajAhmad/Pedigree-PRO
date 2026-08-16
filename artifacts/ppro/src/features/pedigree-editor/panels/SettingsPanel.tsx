import { Settings, RotateCcw } from "lucide-react";
import { PanelShell } from "@/components/shared/panels/PanelShell";
import { useTheme } from "@/lib/theme";
import { useCanvasConfig, DEFAULT_CANVAS_CONFIG, CanvasConfig } from "@/features/pedigree-editor/context/CanvasConfigContext";

import { AppearanceSection } from "./settings/AppearanceSection";
import { CanvasGridSection } from "./settings/CanvasGridSection";
import { LayoutSpacingSection } from "./settings/LayoutSpacingSection";
import { ToolbarSection } from "./settings/ToolbarSection";
import { LabelsAndLayoutSection } from "./settings/LabelsAndLayoutSection";
import { GenotypesSection } from "./settings/GenotypesSection";
import { NodeGeometrySection } from "./settings/NodeGeometrySection";
import { AnnotationDefaultsSection } from "./settings/AnnotationDefaultsSection";

export interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { setTheme } = useTheme();
  const { updateConfig } = useCanvasConfig();

  const handleResetToDefaults = () => {
    setTheme(undefined as any);
    const cleared: Partial<CanvasConfig> = {};
    Object.keys(DEFAULT_CANVAS_CONFIG).forEach((key) => {
      cleared[key as keyof CanvasConfig] = undefined;
    });
    updateConfig(cleared);
  };

  return (
    <PanelShell
      title="Canvas Settings"
      icon={<Settings className="w-3.5 h-3.5" />}
      onClose={onClose}
      width="w-full"
    >
      <div className="space-y-4">
        <AppearanceSection />
        <CanvasGridSection />
        <LayoutSpacingSection />
        <ToolbarSection />
        <LabelsAndLayoutSection />
        <GenotypesSection />
        <NodeGeometrySection />
        <AnnotationDefaultsSection />

        <button
          type="button"
          onClick={handleResetToDefaults}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-border hover:border-primary rounded text-xs text-muted-foreground hover:text-foreground transition-all duration-200 mt-2"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
        </button>
      </div>
    </PanelShell>
  );
}
