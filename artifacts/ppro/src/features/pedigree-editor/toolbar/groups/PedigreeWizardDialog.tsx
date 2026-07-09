import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { computeAutoLayout } from "@/lib/auto-layout";
import type { CanvasData, PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";
import { Sparkles, ArrowRight, ArrowLeft, ChevronsUpDown, RefreshCw, Plus, AlertTriangle } from "lucide-react";

interface PedigreeWizardDialogProps {
  open: boolean;
  onClose: () => void;
  updateCanvas: (updater: (prev: CanvasData) => CanvasData) => void;
  canvasNodes: any[];
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
  runAutoLayout: (respectPinned: boolean, isManual?: boolean, selectedOnly?: boolean) => void;
}

export function PedigreeWizardDialog({
  open,
  onClose,
  updateCanvas,
  canvasNodes,
  openConfirm,
  runAutoLayout,
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
      
      // Reset all wizard configuration options to defaults
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

  const NumberInput = ({
    value,
    onChange,
    min = 0,
    max = 5,
  }: {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
  }) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-accent disabled:opacity-30 transition-colors font-medium text-xs text-foreground"
      >
        -
      </button>
      <span className="w-5 text-center text-xs font-semibold text-foreground">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-accent disabled:opacity-30 transition-colors font-medium text-xs text-foreground"
      >
        +
      </button>
    </div>
  );

  const handleGenerate = (mode: "replace" | "append") => {
    const ts = Date.now();
    const rawData = generateWizardPedigree({
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
    }, `w${ts}_`);

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
        // Appending side-by-side
        const maxX = prev.nodes.reduce((max, node) => Math.max(max, node.x), 0);
        const shiftX = prev.nodes.length > 0 ? maxX + 200 : 0;

        // Shift unlaid nodes to make space
        const shiftedNodes = finalNodes.map((n) => ({ ...n, x: n.x + shiftX }));

        // Merge existing and new
        const mergedNodes = [...prev.nodes, ...shiftedNodes];
        const mergedEdges = [...prev.edges, ...finalEdges];

        // Run auto-layout on the full canvas (which organizes both components side-by-side)
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
            <div className="flex-1 p-6 overflow-y-auto min-h-0 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Pedigree Placement Options</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Your canvas already contains family members. How would you like to place the newly configured pedigree?
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPlacementConfirm(false);
                    handleGenerate("replace");
                  }}
                  className="flex-1 p-5 rounded-xl border border-border bg-card hover:bg-destructive/5 hover:border-destructive/30 transition-all text-center flex flex-col items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-destructive/30"
                >
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive group-hover:scale-105 transition-transform shrink-0">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Clear & Replace</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                      Wipe the current pedigree and start fresh with this family.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPlacementConfirm(false);
                    handleGenerate("append");
                  }}
                  className="flex-1 p-5 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-center flex flex-col items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Add alongside</h4>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-normal">
                      Keep your current pedigree and place this family next to it.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Left Side: Step Configurations */}
              <div className="w-full md:w-[420px] flex-shrink-0 border-b md:border-b-0 md:border-r border-border p-6 overflow-y-auto flex flex-col min-h-0 space-y-6">
                {/* Step 1: Proband Details */}
                {step === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-150">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground">Step 1: Proband (Index Case)</h3>
                      <p className="text-xs text-muted-foreground">We start with the Proband. Define the core traits of the index patient.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                      <div className="grid grid-cols-1 gap-5">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Proband Biological Sex</label>
                          <div className="relative">
                            <select
                              value={probandSex}
                              onChange={(e) => setProbandSex(e.target.value as any)}
                              className="w-full bg-muted border border-border rounded-lg pl-3 pr-10 py-2 text-sm outline-none focus:border-primary transition-colors appearance-none cursor-pointer font-medium"
                            >
                              <option value="male">Male (Square)</option>
                              <option value="female">Female (Circle)</option>
                              <option value="unknown">Unknown (Diamond)</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground/60">
                              <ChevronsUpDown className="w-4 h-4" />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 pt-1">
                          <input
                            type="checkbox"
                            id="prob_aff"
                            checked={probandAffected}
                            onChange={(e) => setProbandAffected(e.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                          />
                          <label htmlFor="prob_aff" className="text-xs font-bold text-foreground select-none cursor-pointer">
                            Mark Proband as Clinically Affected
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Spouse & Offspring */}
                {step === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-150">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground">Step 2: Partner & Children</h3>
                      <p className="text-xs text-muted-foreground">Configure the Proband's partner/spouse and children.</p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="has_partner"
                            checked={hasPartner}
                            onChange={(e) => setHasPartner(e.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                          />
                          <label htmlFor="has_partner" className="text-xs font-bold text-foreground select-none cursor-pointer">
                            Proband is Married or Has a Partner
                          </label>
                        </div>
                      </div>

                      {hasPartner && (
                        <div className="space-y-5 pl-6 pt-4 border-t border-border/40 animate-in fade-in duration-200">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block font-semibold">Spouse Biological Sex</label>
                            <div className="relative">
                              <select
                                value={partnerSex}
                                onChange={(e) => setPartnerSex(e.target.value as any)}
                                className="w-full bg-muted border border-border rounded-lg pl-3 pr-10 py-2 text-sm outline-none focus:border-primary transition-colors appearance-none cursor-pointer font-medium"
                              >
                                <option value="male">Male (Square)</option>
                                <option value="female">Female (Circle)</option>
                                <option value="unknown">Unknown (Diamond)</option>
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground/60">
                                <ChevronsUpDown className="w-4 h-4" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {/* Sons Section */}
                            <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-bold text-foreground">Sons</div>
                                  <div className="text-[10px] text-muted-foreground leading-normal">Number of biological sons</div>
                                </div>
                                <NumberInput value={sons} onChange={setSons} />
                              </div>
                              {sons > 0 && (
                                <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                                  <div>
                                    <div className="text-xs font-bold text-foreground font-semibold text-primary">Clinically Affected Sons</div>
                                    <div className="text-[10px] text-muted-foreground leading-normal">How many biological sons are affected?</div>
                                  </div>
                                  <NumberInput value={affectedSonsCount} onChange={setAffectedSonsCount} max={sons} />
                                </div>
                              )}
                            </div>

                            {/* Daughters Section */}
                            <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="text-xs font-bold text-foreground">Daughters</div>
                                  <div className="text-[10px] text-muted-foreground leading-normal">Number of biological daughters</div>
                                </div>
                                <NumberInput value={daughters} onChange={setDaughters} />
                              </div>
                              {daughters > 0 && (
                                <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                                  <div>
                                    <div className="text-xs font-bold text-foreground font-semibold text-primary">Clinically Affected Daughters</div>
                                    <div className="text-[10px] text-muted-foreground leading-normal">How many biological daughters are affected?</div>
                                  </div>
                                  <NumberInput value={affectedDaughtersCount} onChange={setAffectedDaughtersCount} max={daughters} />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Siblings */}
                {step === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-150">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground">Step 3: Proband's Siblings</h3>
                      <p className="text-xs text-muted-foreground">Specify biological brothers and sisters of the Proband.</p>
                    </div>

                    <div className="space-y-4">
                      {/* Brothers Section */}
                      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-foreground">Brothers</div>
                            <div className="text-[10px] text-muted-foreground leading-normal">Count of biological brothers</div>
                          </div>
                          <NumberInput value={brothers} onChange={setBrothers} />
                        </div>
                        {brothers > 0 && (
                          <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                            <div>
                              <div className="text-xs font-bold text-foreground font-semibold text-primary">Clinically Affected Brothers</div>
                              <div className="text-[10px] text-muted-foreground leading-normal">How many brothers are affected?</div>
                            </div>
                            <NumberInput value={affectedBrothersCount} onChange={setAffectedBrothersCount} max={brothers} />
                          </div>
                        )}
                      </div>

                      {/* Sisters Section */}
                      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-foreground">Sisters</div>
                            <div className="text-[10px] text-muted-foreground leading-normal">Count of biological sisters</div>
                          </div>
                          <NumberInput value={sisters} onChange={setSisters} />
                        </div>
                        {sisters > 0 && (
                          <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                            <div>
                              <div className="text-xs font-bold text-foreground font-semibold text-primary">Clinically Affected Sisters</div>
                              <div className="text-[10px] text-muted-foreground leading-normal">How many sisters are affected?</div>
                            </div>
                            <NumberInput value={affectedSistersCount} onChange={setAffectedSistersCount} max={sisters} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Ancestors & Lineage (Parents and Paternal Lineage) */}
                {step === 4 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-150">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground">Step 4: Ancestors & {generations === 2 ? "Parents" : "Paternal Lineage"}</h3>
                      <p className="text-xs text-muted-foreground">
                        {generations === 2 
                          ? "Configure the biological parents of the Proband." 
                          : "Configure the paternal lineage (Father's side) of the family."}
                      </p>
                    </div>
                    
                    {/* Generation Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground block">Ancestral Generations</label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setGenerations(2);
                            if (step > 4) setStep(4);
                          }}
                          className={`flex-1 py-3 px-4 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                            generations === 2
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border bg-card hover:bg-accent text-muted-foreground"
                          }`}
                        >
                          <span className="text-sm font-bold">Parents Only</span>
                          <span className="text-[10px] opacity-75">2 generations total</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setGenerations(3)}
                          className={`flex-1 py-3 px-4 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                            generations === 3
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border bg-card hover:bg-accent text-muted-foreground"
                          }`}
                        >
                          <span className="text-sm font-bold">Parents & Grandparents</span>
                          <span className="text-[10px] opacity-75">3 generations total</span>
                        </button>
                      </div>
                    </div>

                    {generations === 2 ? (
                      /* 2-Generation Parents Only */
                      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                        <span className="text-xs font-bold text-foreground block">Parents Affected Status</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-border/40 bg-muted/10 text-xs font-semibold text-foreground cursor-pointer select-none">
                            <input type="checkbox" checked={affectedFather} onChange={(e) => setAffectedFather(e.target.checked)} className="rounded border-border h-4 w-4" />
                            <span>Mark Father as Affected</span>
                          </label>
                          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-border/40 bg-muted/10 text-xs font-semibold text-foreground cursor-pointer select-none">
                            <input type="checkbox" checked={affectedMother} onChange={(e) => setAffectedMother(e.target.checked)} className="rounded border-border h-4 w-4" />
                            <span>Mark Mother as Affected</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      /* 3-Generation Paternal Lineage */
                      <div className="space-y-4 pt-3 border-t border-border/60">
                        <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                id="inc_paternal"
                                checked={includePaternal}
                                onChange={(e) => setIncludePaternal(e.target.checked)}
                                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                              />
                              <label htmlFor="inc_paternal" className="text-xs font-bold text-foreground select-none cursor-pointer">
                                Include Paternal Lineage (Father's side)
                              </label>
                            </div>
                          </div>

                          <div className="space-y-3.5 pl-6 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                            <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none font-semibold">
                              <input type="checkbox" checked={affectedFather} onChange={(e) => setAffectedFather(e.target.checked)} className="rounded border-border h-4 w-4" />
                              <span>Mark Father as Clinically Affected</span>
                            </label>

                            {includePaternal && (
                              <div className="space-y-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                                <span className="text-xs font-bold text-foreground block">Paternal Grandparents Affected Status</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                                    <input type="checkbox" checked={affectedPaternalGF} onChange={(e) => setAffectedPaternalGF(e.target.checked)} className="rounded border-border h-4 w-4" />
                                    <span>Pat. Grandfather</span>
                                  </label>
                                  <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                                    <input type="checkbox" checked={affectedPaternalGM} onChange={(e) => setAffectedPaternalGM(e.target.checked)} className="rounded border-border h-4 w-4" />
                                    <span>Pat. Grandmother</span>
                                  </label>
                                </div>

                                <div className="space-y-4 pt-3 border-t border-border/40">
                                  {/* Paternal Uncles */}
                                  <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="text-xs font-bold text-foreground font-semibold">Father's Brothers (Uncles)</div>
                                        <div className="text-[10px] text-muted-foreground leading-normal">Number of paternal uncles</div>
                                      </div>
                                      <NumberInput value={paternalUncles} onChange={setPaternalUncles} />
                                    </div>
                                    {paternalUncles > 0 && (
                                      <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                                        <div>
                                          <div className="text-xs font-bold text-foreground font-semibold text-primary">Affected Paternal Uncles</div>
                                          <div className="text-[10px] text-muted-foreground leading-normal">How many paternal uncles are affected?</div>
                                        </div>
                                        <NumberInput value={affectedPaternalUnclesCount} onChange={setAffectedPaternalUnclesCount} max={paternalUncles} />
                                      </div>
                                    )}
                                  </div>

                                  {/* Paternal Aunts */}
                                  <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="text-xs font-bold text-foreground font-semibold">Father's Sisters (Aunts)</div>
                                        <div className="text-[10px] text-muted-foreground leading-normal">Number of paternal aunts</div>
                                      </div>
                                      <NumberInput value={paternalAunts} onChange={setPaternalAunts} />
                                    </div>
                                    {paternalAunts > 0 && (
                                      <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                                        <div>
                                          <div className="text-xs font-bold text-foreground font-semibold text-primary">Affected Paternal Aunts</div>
                                          <div className="text-[10px] text-muted-foreground leading-normal">How many paternal aunts are affected?</div>
                                        </div>
                                        <NumberInput value={affectedPaternalAuntsCount} onChange={setAffectedPaternalAuntsCount} max={paternalAunts} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 5: Maternal Lineage (Grandparents, Uncles, Aunts & Affected Counts) */}
                {step === 5 && generations === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-150">
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-foreground">Step 5: Maternal Lineage</h3>
                      <p className="text-xs text-muted-foreground">Configure the maternal lineage (Mother's side) of the family.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              id="inc_maternal"
                              checked={includeMaternal}
                              onChange={(e) => setIncludeMaternal(e.target.checked)}
                              className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                            />
                            <label htmlFor="inc_maternal" className="text-xs font-bold text-foreground select-none cursor-pointer">
                              Include Maternal Lineage (Mother's side)
                            </label>
                          </div>
                        </div>

                        <div className="space-y-3.5 pl-6 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                          <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none font-semibold">
                            <input type="checkbox" checked={affectedMother} onChange={(e) => setAffectedMother(e.target.checked)} className="rounded border-border h-4 w-4" />
                            <span>Mark Mother as Clinically Affected</span>
                          </label>

                          {includeMaternal && (
                            <div className="space-y-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                              <span className="text-xs font-bold text-foreground block">Maternal Grandparents Affected Status</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                                  <input type="checkbox" checked={affectedMaternalGF} onChange={(e) => setAffectedMaternalGF(e.target.checked)} className="rounded border-border h-4 w-4" />
                                  <span>Mat. Grandfather</span>
                                </label>
                                <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                                  <input type="checkbox" checked={affectedMaternalGM} onChange={(e) => setAffectedMaternalGM(e.target.checked)} className="rounded border-border h-4 w-4" />
                                  <span>Mat. Grandmother</span>
                                </label>
                              </div>

                              <div className="space-y-4 pt-3 border-t border-border/40">
                                {/* Maternal Uncles */}
                                <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-xs font-bold text-foreground font-semibold">Mother's Brothers (Uncles)</div>
                                      <div className="text-[10px] text-muted-foreground leading-normal">Number of maternal uncles</div>
                                    </div>
                                    <NumberInput value={maternalUncles} onChange={setMaternalUncles} />
                                  </div>
                                  {maternalUncles > 0 && (
                                    <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                                      <div>
                                        <div className="text-xs font-bold text-foreground font-semibold text-primary">Affected Maternal Uncles</div>
                                        <div className="text-[10px] text-muted-foreground leading-normal">How many maternal uncles are affected?</div>
                                      </div>
                                      <NumberInput value={affectedMaternalUnclesCount} onChange={setAffectedMaternalUnclesCount} max={maternalUncles} />
                                    </div>
                                  )}
                                </div>

                                {/* Maternal Aunts */}
                                <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="text-xs font-bold text-foreground font-semibold">Mother's Sisters (Aunts)</div>
                                      <div className="text-[10px] text-muted-foreground leading-normal">Number of maternal aunts</div>
                                    </div>
                                    <NumberInput value={maternalAunts} onChange={setMaternalAunts} />
                                  </div>
                                  {maternalAunts > 0 && (
                                    <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                                      <div>
                                        <div className="text-xs font-bold text-foreground font-semibold text-primary">Affected Maternal Aunts</div>
                                        <div className="text-[10px] text-muted-foreground leading-normal">How many maternal aunts are affected?</div>
                                      </div>
                                      <NumberInput value={affectedMaternalAuntsCount} onChange={setAffectedMaternalAuntsCount} max={maternalAunts} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side: Live Canvas Preview */}
              <div className="flex-1 bg-slate-50/50 dark:bg-slate-900/10 p-6 flex flex-col justify-center items-center relative overflow-hidden border-t md:border-t-0 border-border">
                <div className="absolute top-4 left-4 z-10">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-background border border-border px-2 py-0.5 rounded-full shadow-sm">
                    Live Preview
                  </span>
                </div>
                <div className="w-full h-full flex items-center justify-center">
                  <PedigreePreview step={step} config={{
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
                  }} />
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

export interface PedigreeWizardConfig {
  generations: 2 | 3;
  includePaternal: boolean;
  paternalUncles: number;
  paternalAunts: number;
  includeMaternal: boolean;
  maternalUncles: number;
  maternalAunts: number;
  probandSex: "male" | "female" | "unknown";
  probandAffected: boolean;
  brothers: number;
  sisters: number;
  hasPartner: boolean;
  partnerSex: "male" | "female" | "unknown";
  sons: number;
  daughters: number;
  affectedFather: boolean;
  affectedMother: boolean;
  affectedPaternalGF: boolean;
  affectedPaternalGM: boolean;
  affectedMaternalGF: boolean;
  affectedMaternalGM: boolean;
  affectedBrothersCount: number;
  affectedSistersCount: number;
  affectedPaternalUnclesCount: number;
  affectedPaternalAuntsCount: number;
  affectedMaternalUnclesCount: number;
  affectedMaternalAuntsCount: number;
  affectedSonsCount: number;
  affectedDaughtersCount: number;
}

export function generateWizardPedigree(
  config: PedigreeWizardConfig,
  prefix: string
): { nodes: PedigreeNode[]; edges: PedigreeEdge[] } {
  const nodes: PedigreeNode[] = [];
  const edges: PedigreeEdge[] = [];

  const createNode = (
    id: string,
    type: PedigreeNode["type"],
    label: string,
    affected: boolean = false,
    extra: Partial<PedigreeNode> = {}
  ): PedigreeNode => ({
    id: prefix + id,
    type,
    affected,
    carrier: false,
    deceased: false,
    proband: id === "proband",
    label,
    age: "",
    x: 0,
    y: 0,
    ...extra,
  });

  const createEdge = (
    type: PedigreeEdge["type"],
    sourceId: string,
    targetId: string
  ): PedigreeEdge => ({
    id: `${prefix}e_${edges.length + 1}`,
    type,
    sourceId: prefix + sourceId,
    targetId: prefix + targetId,
  });

  // 1. Proband
  nodes.push(createNode("proband", config.probandSex, "Proband", config.probandAffected, { proband: true }));

  // 2. Parents
  nodes.push(createNode("father", "male", "Father", config.affectedFather));
  nodes.push(createNode("mother", "female", "Mother", config.affectedMother));
  edges.push(createEdge("couple", "father", "mother"));
  edges.push(createEdge("parent-child", "father", "proband"));
  edges.push(createEdge("parent-child", "mother", "proband"));

  // 3. Siblings of Proband
  for (let i = 1; i <= config.brothers; i++) {
    const isAff = i <= config.affectedBrothersCount;
    nodes.push(createNode(`brother_${i}`, "male", `Brother ${i}`, isAff));
    edges.push(createEdge("parent-child", "father", `brother_${i}`));
    edges.push(createEdge("parent-child", "mother", `brother_${i}`));
  }
  for (let i = 1; i <= config.sisters; i++) {
    const isAff = i <= config.affectedSistersCount;
    nodes.push(createNode(`sister_${i}`, "female", `Sister ${i}`, isAff));
    edges.push(createEdge("parent-child", "father", `sister_${i}`));
    edges.push(createEdge("parent-child", "mother", `sister_${i}`));
  }

  // 4. Paternal Lineage
  if (config.generations === 3 && config.includePaternal) {
    nodes.push(createNode("pgf", "male", "Pat. Grandfather", config.affectedPaternalGF));
    nodes.push(createNode("pgm", "female", "Pat. Grandmother", config.affectedPaternalGM));
    edges.push(createEdge("couple", "pgf", "pgm"));
    edges.push(createEdge("parent-child", "pgf", "father"));
    edges.push(createEdge("parent-child", "pgm", "father"));

    for (let i = 1; i <= config.paternalUncles; i++) {
      const isAff = i <= config.affectedPaternalUnclesCount;
      nodes.push(createNode(`pat_uncle_${i}`, "male", `Pat. Uncle ${i}`, isAff));
      edges.push(createEdge("parent-child", "pgf", `pat_uncle_${i}`));
      edges.push(createEdge("parent-child", "pgm", `pat_uncle_${i}`));
    }
    for (let i = 1; i <= config.paternalAunts; i++) {
      const isAff = i <= config.affectedPaternalAuntsCount;
      nodes.push(createNode(`pat_aunt_${i}`, "female", `Pat. Aunt ${i}`, isAff));
      edges.push(createEdge("parent-child", "pgf", `pat_aunt_${i}`));
      edges.push(createEdge("parent-child", "pgm", `pat_aunt_${i}`));
    }
  }

  // 5. Maternal Lineage
  if (config.generations === 3 && config.includeMaternal) {
    nodes.push(createNode("mgf", "male", "Mat. Grandfather", config.affectedMaternalGF));
    nodes.push(createNode("mgm", "female", "Mat. Grandmother", config.affectedMaternalGM));
    edges.push(createEdge("couple", "mgf", "mgm"));
    edges.push(createEdge("parent-child", "mgf", "mother"));
    edges.push(createEdge("parent-child", "mgm", "mother"));

    for (let i = 1; i <= config.maternalUncles; i++) {
      const isAff = i <= config.affectedMaternalUnclesCount;
      nodes.push(createNode(`mat_uncle_${i}`, "male", `Mat. Uncle ${i}`, isAff));
      edges.push(createEdge("parent-child", "mgf", `mat_uncle_${i}`));
      edges.push(createEdge("parent-child", "mgm", `mat_uncle_${i}`));
    }
    for (let i = 1; i <= config.maternalAunts; i++) {
      const isAff = i <= config.affectedMaternalAuntsCount;
      nodes.push(createNode(`mat_aunt_${i}`, "female", `Mat. Aunt ${i}`, isAff));
      edges.push(createEdge("parent-child", "mgf", `mat_aunt_${i}`));
      edges.push(createEdge("parent-child", "mgm", `mat_aunt_${i}`));
    }
  }

  // 6. Proband Offspring
  if (config.hasPartner) {
    nodes.push(createNode("partner", config.partnerSex, "Spouse"));
    edges.push(createEdge("couple", "proband", "partner"));

    for (let i = 1; i <= config.sons; i++) {
      const isAff = i <= config.affectedSonsCount;
      nodes.push(createNode(`son_${i}`, "male", `Son ${i}`, isAff));
      edges.push(createEdge("parent-child", "proband", `son_${i}`));
      edges.push(createEdge("parent-child", "partner", `son_${i}`));
    }
    for (let i = 1; i <= config.daughters; i++) {
      const isAff = i <= config.affectedDaughtersCount;
      nodes.push(createNode(`daughter_${i}`, "female", `Daughter ${i}`, isAff));
      edges.push(createEdge("parent-child", "proband", `daughter_${i}`));
      edges.push(createEdge("parent-child", "partner", `daughter_${i}`));
    }
  }

  return { nodes, edges };
}

function PedigreePreview({ step, config }: { step: number; config: PedigreeWizardConfig }) {
  // 1. Generate preview nodes and edges
  const rawData = generateWizardPedigree(config, "prev_");
  
  // Filter nodes dynamically by the current step
  const stepNodes = rawData.nodes.filter(n => {
    if (n.id.endsWith("proband")) return true;
    if (step === 1) return false;
    
    if (n.id.includes("partner") || n.id.includes("son_") || n.id.includes("daughter_")) {
      return step >= 2;
    }
    
    if (n.id.includes("father") || n.id.includes("mother") || n.id.includes("brother_") || n.id.includes("sister_")) {
      return step >= 3;
    }
    
    if (n.id.includes("pgf") || n.id.includes("pgm") || n.id.includes("pat_uncle_") || n.id.includes("pat_aunt_")) {
      return step >= 4;
    }
    
    if (n.id.includes("mgf") || n.id.includes("mgm") || n.id.includes("mat_uncle_") || n.id.includes("mat_aunt_")) {
      return step >= 5;
    }
    
    return true;
  });

  const stepNodeIds = new Set(stepNodes.map(n => n.id));
  const stepEdges = rawData.edges.filter(e => stepNodeIds.has(e.sourceId) && stepNodeIds.has(e.targetId));

  // 2. Compute positions using auto-layout
  const layoutNodes = stepNodes.map(n => ({ id: n.id, x: 0, y: 0, type: n.type }));
  const layoutEdges = stepEdges.map(e => ({ id: e.id, type: e.type, sourceId: e.sourceId, targetId: e.targetId }));
  const positions = computeAutoLayout(layoutNodes, layoutEdges, false, { enableCache: false });
  
  const nodes = stepNodes.map(n => {
    const pos = positions.find(p => p.id === n.id);
    return pos ? { ...n, x: pos.x, y: pos.y } : { ...n, x: 0, y: 0 };
  });
  const edges = stepEdges;

  if (nodes.length === 0) return null;

  // 3. Compute bounding box
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - 80;
  const maxX = Math.max(...xs) + 80;
  const minY = Math.min(...ys) - 80;
  const maxY = Math.max(...ys) + 120; // extra padding at bottom for labels
  const width = maxX - minX;
  const height = maxY - minY;

  // 4. Render couple lines
  const coupleLines = edges
    .filter(e => e.type === "couple")
    .map(e => {
      const n1 = nodes.find(n => n.id === e.sourceId);
      const n2 = nodes.find(n => n.id === e.targetId);
      if (!n1 || !n2) return null;
      return (
        <line
          key={e.id}
          x1={n1.x}
          y1={n1.y}
          x2={n2.x}
          y2={n2.y}
          className="stroke-slate-300 dark:stroke-slate-700"
          strokeWidth={1.5}
        />
      );
    })
    .filter(Boolean);

  // 5. Render parent-child lines
  const parentToChildren = new Map<string, string[]>(); // parentKey -> childIds
  for (const node of nodes) {
    const pEdges = edges.filter(e => e.type === "parent-child" && e.targetId === node.id);
    if (pEdges.length > 0) {
      const pIds = pEdges.map(e => e.sourceId).sort();
      const pKey = pIds.join("|");
      if (!parentToChildren.has(pKey)) {
        parentToChildren.set(pKey, []);
      }
      parentToChildren.get(pKey)!.push(node.id);
    }
  }

  const parentChildLines: React.ReactNode[] = [];
  let lineIndex = 0;

  for (const [pKey, childIds] of parentToChildren) {
    const parentIds = pKey.split("|");
    const childrenNodes = nodes.filter(n => childIds.includes(n.id));
    if (childrenNodes.length === 0) continue;

    if (parentIds.length === 2) {
      const p1 = nodes.find(n => n.id === parentIds[0]);
      const p2 = nodes.find(n => n.id === parentIds[1]);
      if (p1 && p2) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const sibshipY = midY + 45;

        // Draw line from couple midpoint to sibship Y
        parentChildLines.push(
          <line
            key={`pc_mid_${lineIndex++}`}
            x1={midX}
            y1={midY}
            x2={midX}
            y2={sibshipY}
            className="stroke-slate-300 dark:stroke-slate-700"
            strokeWidth={1.5}
          />
        );

        // Draw horizontal sibship bar connecting couple midpoint to children boundaries (prevents gaps)
        const childXs = childrenNodes.map(c => c.x);
        const minXBound = Math.min(midX, ...childXs);
        const maxXBound = Math.max(midX, ...childXs);
        if (maxXBound - minXBound > 1) {
          parentChildLines.push(
            <line
              key={`pc_bar_${lineIndex++}`}
              x1={minXBound}
              y1={sibshipY}
              x2={maxXBound}
              y2={sibshipY}
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={1.5}
            />
          );
        }

        // Draw lines from sibship bar to each child
        for (const child of childrenNodes) {
          parentChildLines.push(
            <line
              key={`pc_child_${lineIndex++}`}
              x1={child.x}
              y1={sibshipY}
              x2={child.x}
              y2={child.y}
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={1.5}
            />
          );
        }
      }
    } else if (parentIds.length === 1) {
      const p = nodes.find(n => n.id === parentIds[0]);
      if (p) {
        for (const child of childrenNodes) {
          parentChildLines.push(
            <line
              key={`pc_single_${lineIndex++}`}
              x1={p.x}
              y1={p.y}
              x2={child.x}
              y2={child.y}
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth={1.5}
            />
          );
        }
      }
    }
  }

  return (
    <svg
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="w-full h-full max-h-[380px] p-2 select-none text-slate-800 dark:text-slate-200"
    >
      <defs>
        <marker
          id="prev-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-800 dark:fill-slate-200" />
        </marker>
      </defs>

      <g>{coupleLines}</g>
      <g>{parentChildLines}</g>

      {nodes.map(n => {
        const isMale = n.type === "male";
        const isFemale = n.type === "female";
        const isUnknown = n.type === "unknown";

        return (
          <g key={n.id}>
            {isMale && (
              <rect
                x={n.x - 14}
                y={n.y - 14}
                width={28}
                height={28}
                className={`${
                  n.affected
                    ? "fill-slate-800 dark:fill-slate-200"
                    : "fill-white dark:fill-slate-900"
                } stroke-slate-800 dark:stroke-slate-200`}
                strokeWidth={1.75}
                rx={1.5}
              />
            )}
            {isFemale && (
              <circle
                cx={n.x}
                cy={n.y}
                r={14}
                className={`${
                  n.affected
                    ? "fill-slate-800 dark:fill-slate-200"
                    : "fill-white dark:fill-slate-900"
                } stroke-slate-800 dark:stroke-slate-200`}
                strokeWidth={1.75}
              />
            )}
            {isUnknown && (
              <polygon
                points={`${n.x},${n.y - 18} ${n.x + 18},${n.y} ${n.x},${n.y + 18} ${n.x - 18},${n.y}`}
                className={`${
                  n.affected
                    ? "fill-slate-800 dark:fill-slate-200"
                    : "fill-white dark:fill-slate-900"
                } stroke-slate-800 dark:stroke-slate-200`}
                strokeWidth={1.75}
              />
            )}

            {n.proband && (
              <path
                d={`M ${n.x - 28} ${n.y + 28} L ${n.x - 18} ${n.y + 18}`}
                className="stroke-slate-800 dark:stroke-slate-200 fill-slate-800 dark:fill-slate-200"
                strokeWidth={2}
                markerEnd="url(#prev-arrow)"
              />
            )}

            <text
              x={n.x}
              y={n.y + 28}
              textAnchor="middle"
              fontSize={8.5}
              fontWeight="700"
              className="fill-slate-500 dark:fill-slate-400"
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
