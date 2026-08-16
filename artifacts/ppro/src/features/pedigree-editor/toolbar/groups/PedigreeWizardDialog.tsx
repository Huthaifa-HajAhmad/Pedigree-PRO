import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { computeAutoLayout } from "@/lib/auto-layout";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";
import { Sparkles, ArrowRight, ArrowLeft } from "lucide-react";

import type { PedigreeWizardDialogProps, PedigreeWizardConfig } from "./wizard/types";
import { generateWizardPedigree } from "./wizard/generator";
import { PedigreePreview } from "./wizard/PedigreePreview";
import { WizardPlacementConfirm } from "./wizard/WizardPlacementConfirm";
import { WizardSteps } from "./wizard/WizardSteps";

export { generateWizardPedigree } from "./wizard/generator";
export type { PedigreeWizardConfig } from "./wizard/types";

export function PedigreeWizardDialog({
  open,
  onClose,
  updateCanvas,
  canvasNodes,
  openConfirm,
}: PedigreeWizardDialogProps) {
  const [step, setStep] = useState<number>(1);
  const [showPlacementConfirm, setShowPlacementConfirm] = useState(false);

  // Config State
  const [generations, setGenerations] = useState<2 | 3>(3);
  const [includePaternal, setIncludePaternal] = useState(true);
  const [paternalUncles, setPaternalUncles] = useState(0);
  const [paternalAunts, setPaternalAunts] = useState(0);
  const [includeMaternal, setIncludeMaternal] = useState(true);
  const [maternalUncles, setMaternalUncles] = useState(0);
  const [maternalAunts, setMaternalAunts] = useState(0);

  const [probandSex, setProbandSex] = useState<"male" | "female" | "unknown">("male");
  const [probandAffected, setProbandAffected] = useState(false);
  const [brothers, setBrothers] = useState(0);
  const [sisters, setSisters] = useState(0);

  const [hasPartner, setHasPartner] = useState(false);
  const [partnerSex, setPartnerSex] = useState<"male" | "female" | "unknown">("female");
  const [sons, setSons] = useState(0);
  const [daughters, setDaughters] = useState(0);

  const [affectedFather, setAffectedFather] = useState(false);
  const [affectedMother, setAffectedMother] = useState(false);
  const [affectedPaternalGF, setAffectedPaternalGF] = useState(false);
  const [affectedPaternalGM, setAffectedPaternalGM] = useState(false);
  const [affectedMaternalGF, setAffectedMaternalGF] = useState(false);
  const [affectedMaternalGM, setAffectedMaternalGM] = useState(false);

  const [affectedBrothersCount, setAffectedBrothersCount] = useState(0);
  const [affectedSistersCount, setAffectedSistersCount] = useState(0);
  const [affectedPaternalUnclesCount, setAffectedPaternalUnclesCount] = useState(0);
  const [affectedPaternalAuntsCount, setAffectedPaternalAuntsCount] = useState(0);
  const [affectedMaternalUnclesCount, setAffectedMaternalUnclesCount] = useState(0);
  const [affectedMaternalAuntsCount, setAffectedMaternalAuntsCount] = useState(0);
  const [affectedSonsCount, setAffectedSonsCount] = useState(0);
  const [affectedDaughtersCount, setAffectedDaughtersCount] = useState(0);

  // Auto-align partner sex opposite to proband sex for convenience
  useEffect(() => {
    if (probandSex === "male") {
      setPartnerSex("female");
    } else if (probandSex === "female") {
      setPartnerSex("male");
    }
  }, [probandSex]);

  // Reset steps and config on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setShowPlacementConfirm(false);
      
      setGenerations(3);
      setIncludePaternal(true);
      setPaternalUncles(0);
      setPaternalAunts(0);
      setIncludeMaternal(true);
      setMaternalUncles(0);
      setMaternalAunts(0);
      setProbandSex("male");
      setProbandAffected(false);
      setBrothers(0);
      setSisters(0);
      setHasPartner(false);
      setPartnerSex("female");
      setSons(0);
      setDaughters(0);
      setAffectedFather(false);
      setAffectedMother(false);
      setAffectedPaternalGF(false);
      setAffectedPaternalGM(false);
      setAffectedMaternalGF(false);
      setAffectedMaternalGM(false);
      setAffectedBrothersCount(0);
      setAffectedSistersCount(0);
      setAffectedPaternalUnclesCount(0);
      setAffectedPaternalAuntsCount(0);
      setAffectedMaternalUnclesCount(0);
      setAffectedMaternalAuntsCount(0);
      setAffectedSonsCount(0);
      setAffectedDaughtersCount(0);
    }
  }, [open]);

  // Cap affected counts if limits change
  useEffect(() => {
    if (affectedBrothersCount > brothers) setAffectedBrothersCount(brothers);
    if (affectedSistersCount > sisters) setAffectedSistersCount(sisters);
    if (affectedPaternalUnclesCount > paternalUncles) setAffectedPaternalUnclesCount(paternalUncles);
    if (affectedPaternalAuntsCount > paternalAunts) setAffectedPaternalAuntsCount(paternalAunts);
    if (affectedMaternalUnclesCount > maternalUncles) setAffectedMaternalUnclesCount(maternalUncles);
    if (affectedMaternalAuntsCount > maternalAunts) setAffectedMaternalAuntsCount(maternalAunts);
    if (affectedSonsCount > sons) setAffectedSonsCount(sons);
    if (affectedDaughtersCount > daughters) setAffectedDaughtersCount(daughters);
  }, [
    brothers, sisters, paternalUncles, paternalAunts, maternalUncles, maternalAunts, sons, daughters,
    affectedBrothersCount, affectedSistersCount, affectedPaternalUnclesCount, affectedPaternalAuntsCount,
    affectedMaternalUnclesCount, affectedMaternalAuntsCount, affectedSonsCount, affectedDaughtersCount
  ]);

  const currentConfig: PedigreeWizardConfig = {
    generations,
    includePaternal,
    paternalUncles,
    paternalAunts,
    includeMaternal,
    maternalUncles,
    maternalAunts,
    probandSex,
    probandAffected,
    brothers,
    sisters,
    hasPartner,
    partnerSex,
    sons,
    daughters,
    affectedFather,
    affectedMother,
    affectedPaternalGF,
    affectedPaternalGM,
    affectedMaternalGF,
    affectedMaternalGM,
    affectedBrothersCount,
    affectedSistersCount,
    affectedPaternalUnclesCount,
    affectedPaternalAuntsCount,
    affectedMaternalUnclesCount,
    affectedMaternalAuntsCount,
    affectedSonsCount,
    affectedDaughtersCount
  };

  const handleGenerate = (mode: "replace" | "append") => {
    const ts = Date.now();
    const rawData = generateWizardPedigree(currentConfig, `w${ts}_`);

    if (rawData.nodes.length === 0) return;

    const runLayoutAndCommit = (prev: CanvasData) => {
      let finalNodes = [...rawData.nodes];
      let finalEdges = [...rawData.edges];

      if (mode === "replace") {
        const layoutResult = computeAutoLayout(finalNodes, finalEdges, false);
        const mapped = finalNodes.map((n) => {
          const l = layoutResult.find((r) => r.id === n.id);
          return l ? { ...n, x: l.x, y: l.y } : n;
        });
        return { nodes: mapped, edges: finalEdges, annotations: [] };
      } else {
        const maxX = prev.nodes.reduce((max, node) => Math.max(max, node.x), 0);
        const shiftX = prev.nodes.length > 0 ? maxX + 200 : 0;

        const shiftedNodes = finalNodes.map((n) => ({ ...n, x: n.x + shiftX }));
        const mergedNodes = [...prev.nodes, ...shiftedNodes];
        const mergedEdges = [...prev.edges, ...finalEdges];

        const layoutResult = computeAutoLayout(mergedNodes, mergedEdges, false);
        const mapped = mergedNodes.map((n) => {
          const l = layoutResult.find((r) => r.id === n.id);
          return l ? { ...n, x: l.x, y: l.y } : n;
        });

        return { nodes: mapped, edges: mergedEdges, annotations: prev.annotations || [] };
      }
    };

    if (mode === "replace" && canvasNodes.length > 0) {
      openConfirm(
        "Clear Canvas & Build",
        "Are you sure you want to clear your current canvas and start a new pedigree? This will clear local undo history.",
        () => {
          updateCanvas((prev) => runLayoutAndCommit(prev));
          onClose();
        }
      );
    } else {
      updateCanvas((prev) => runLayoutAndCommit(prev));
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl md:max-w-6xl p-0 overflow-hidden bg-background border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-[85vh] md:h-[620px] max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-md font-bold text-foreground">Pedigree Auto-Builder Wizard</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Configure family parameters to construct a structured pedigree instantly.</DialogDescription>
            </div>
          </div>
        </div>

        {/* Step Progress indicators */}
        {!showPlacementConfirm && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-slate-50/20 dark:bg-slate-950/20">
            <div className="flex items-center gap-1.5 flex-1 max-w-xs">
              {Array.from({ length: generations === 2 ? 4 : 5 }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                    s === step
                      ? "bg-primary"
                      : s < step
                      ? "bg-primary/40"
                      : "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Step {step} of {generations === 2 ? 4 : 5}
            </span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 bg-background">
          {showPlacementConfirm ? (
            <WizardPlacementConfirm
              onReplace={() => {
                setShowPlacementConfirm(false);
                handleGenerate("replace");
              }}
              onAppend={() => {
                setShowPlacementConfirm(false);
                handleGenerate("append");
              }}
            />
          ) : (
            <>
              {/* Left Side: Step Configurations */}
              <WizardSteps
                step={step}
                setStep={setStep}
                config={{
                  generations, setGenerations,
                  includePaternal, setIncludePaternal,
                  paternalUncles, setPaternalUncles,
                  paternalAunts, setPaternalAunts,
                  includeMaternal, setIncludeMaternal,
                  maternalUncles, setMaternalUncles,
                  maternalAunts, setMaternalAunts,
                  probandSex, setProbandSex,
                  probandAffected, setProbandAffected,
                  brothers, setBrothers,
                  sisters, setSisters,
                  hasPartner, setHasPartner,
                  partnerSex, setPartnerSex,
                  sons, setSons,
                  daughters, setDaughters,
                  affectedFather, setAffectedFather,
                  affectedMother, setAffectedMother,
                  affectedPaternalGF, setAffectedPaternalGF,
                  affectedPaternalGM, setAffectedPaternalGM,
                  affectedMaternalGF, setAffectedMaternalGF,
                  affectedMaternalGM, setAffectedMaternalGM,
                  affectedBrothersCount, setAffectedBrothersCount,
                  affectedSistersCount, setAffectedSistersCount,
                  affectedPaternalUnclesCount, setAffectedPaternalUnclesCount,
                  affectedPaternalAuntsCount, setAffectedPaternalAuntsCount,
                  affectedMaternalUnclesCount, setAffectedMaternalUnclesCount,
                  affectedMaternalAuntsCount, setAffectedMaternalAuntsCount,
                  affectedSonsCount, setAffectedSonsCount,
                  affectedDaughtersCount, setAffectedDaughtersCount,
                }}
              />

              {/* Right Side: Live Canvas Preview */}
              <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/10 p-6 flex flex-col justify-center items-center relative overflow-hidden border-t md:border-t-0 border-border">
                <div className="absolute top-4 left-4 z-10">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-background border border-border px-2 py-0.5 rounded-full shadow-sm">
                    Live Preview
                  </span>
                </div>
                <div className="w-full h-full flex items-center justify-center">
                  <PedigreePreview step={step} config={currentConfig} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
          {showPlacementConfirm ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowPlacementConfirm(false)} className="gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Config
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {step > 1 && (
                  <Button onClick={() => setStep(step - 1)} className="gap-1.5" variant="outline" size="sm">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </Button>
                )}
                {step < (generations === 2 ? 4 : 5) ? (
                  <Button onClick={() => setStep(step + 1)} className="gap-1.5" variant="outline" size="sm">
                    Next
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (canvasNodes.length > 0) {
                        setShowPlacementConfirm(true);
                      } else {
                        handleGenerate("replace");
                      }
                    }}
                    className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground border-primary-border"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Build Pedigree
                  </Button>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
