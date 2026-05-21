import { useState, useCallback, useRef, useEffect } from "react";
import { LayoutTemplate, TrendingUp, AlertTriangle, ShieldCheck, BookOpen } from "lucide-react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";

interface TemplateOption {
  key: string;
  name: string;
  desc: string;
}

interface ValidationSummary {
  errorCount: number;
  warningCount: number;
}

interface ClinicalGroupProps {
  showTemplates: boolean;
  setShowTemplates: React.Dispatch<React.SetStateAction<boolean>>;
  showRiskPanel: boolean;
  setShowRiskPanel: React.Dispatch<React.SetStateAction<boolean>>;
  showValidation: boolean;
  setShowValidation: React.Dispatch<React.SetStateAction<boolean>>;
  showLegend: boolean;
  setShowLegend: React.Dispatch<React.SetStateAction<boolean>>;
  validation: ValidationSummary;
  templates: readonly TemplateOption[];
  buildTemplate: (key: string) => CanvasData;
  updateCanvas: (updater: (prev: CanvasData) => CanvasData) => void;
  canvasNodesLength: number;
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
  labelHidden?: boolean;
  onClearSelection?: () => void;
}

function useDropdownPosition(ref: React.RefObject<HTMLButtonElement | null>) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, [ref]);
  return { pos, measure };
}

export function ClinicalGroup({
  showTemplates, setShowTemplates, showRiskPanel, setShowRiskPanel,
  showValidation, setShowValidation, showLegend, setShowLegend,
  validation, templates, buildTemplate, updateCanvas, canvasNodesLength, openConfirm, labelHidden = false,
  onClearSelection,
}: ClinicalGroupProps) {
  const tplRef = useRef<HTMLButtonElement>(null);
  const { pos: tplPos, measure: measureTpl } = useDropdownPosition(tplRef);

  useEffect(() => {
    if (!showTemplates) return;
    measureTpl();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowTemplates(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showTemplates, measureTpl, setShowTemplates]);

  const handleRiskToggle = () => {
    setShowRiskPanel((v) => !v);
    setShowValidation(false);
    onClearSelection?.();
  };

  const handleValidationToggle = () => {
    setShowValidation((v) => !v);
    setShowRiskPanel(false);
    onClearSelection?.();
  };

  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button ref={tplRef} type="button" data-testid="button-templates"
          onClick={() => { setShowTemplates((v) => !v); }}
          title="Pedigree templates"
          aria-label="Pedigree templates"
          aria-expanded={showTemplates}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${showTemplates ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <LayoutTemplate className="w-5 h-5" />
          <span>Templates</span>
        </button>
        <button type="button" data-testid="button-risk" onClick={handleRiskToggle} title="Risk calculator panel" aria-label="Risk calculator panel"
          aria-pressed={showRiskPanel}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${showRiskPanel ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
          <TrendingUp className="w-5 h-5" />
          <span>Risk</span>
        </button>
        <button type="button" data-testid="button-validate" onClick={handleValidationToggle} title="Pedigree validation" aria-label="Pedigree validation"
          aria-pressed={showValidation}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${
            showValidation ? "bg-primary/10 text-primary"
            : validation.errorCount > 0 ? "text-destructive bg-destructive/10"
            : validation.warningCount > 0 ? "text-orange-400 bg-orange-400/10"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}>
          {validation.errorCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          <span>{validation.errorCount > 0 ? `${validation.errorCount} Err` : validation.warningCount > 0 ? `${validation.warningCount} Warn` : "Valid"}</span>
        </button>
        <button type="button" data-testid="button-legend" onClick={() => setShowLegend((v) => !v)} title="Toggle legend panel" aria-label="Toggle legend panel"
          disabled={canvasNodesLength === 0}
          aria-pressed={showLegend}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${
            canvasNodesLength === 0 ? "opacity-30 cursor-not-allowed"
            : showLegend ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}>
          <BookOpen className="w-5 h-5" />
          <span>Legend</span>
        </button>
        {showTemplates && tplPos && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowTemplates(false)} />
            <div className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl min-w-[240px]"
              style={{ top: tplPos.top, left: tplPos.left }}>
              <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">Start from template</div>
              {templates.map((tpl) => (
                <button type="button" key={tpl.key}
                  onClick={() => {
                    if (canvasNodesLength === 0) {
                      const data = buildTemplate(tpl.key);
                      updateCanvas(() => data);
                      setShowTemplates(false);
                      return;
                    }
                    openConfirm("Replace Pedigree", "Replace current pedigree with template?", () => {
                      const data = buildTemplate(tpl.key);
                      updateCanvas(() => data);
                      setShowTemplates(false);
                    });
                  }}
                  className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left border-t border-border first:border-0">
                  <LayoutTemplate className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <div>
                    <div className="text-xs font-medium">{tpl.name}</div>
                    <div className="text-xs text-muted-foreground">{tpl.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Clinical</div>}
    </div>
  );
}
