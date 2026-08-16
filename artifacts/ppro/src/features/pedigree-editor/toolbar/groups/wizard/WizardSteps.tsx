import { ChevronsUpDown } from "lucide-react";

function NumberInput({
  value,
  onChange,
  min = 0,
  max = 5,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
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
}

export function WizardSteps({
  step,
  setStep,
  config,
}: {
  step: number;
  setStep: (s: number) => void;
  config: {
    generations: 2 | 3; setGenerations: (v: 2 | 3) => void;
    includePaternal: boolean; setIncludePaternal: (v: boolean) => void;
    paternalUncles: number; setPaternalUncles: (v: number) => void;
    paternalAunts: number; setPaternalAunts: (v: number) => void;
    includeMaternal: boolean; setIncludeMaternal: (v: boolean) => void;
    maternalUncles: number; setMaternalUncles: (v: number) => void;
    maternalAunts: number; setMaternalAunts: (v: number) => void;
    probandSex: "male" | "female" | "unknown"; setProbandSex: (v: "male" | "female" | "unknown") => void;
    probandAffected: boolean; setProbandAffected: (v: boolean) => void;
    brothers: number; setBrothers: (v: number) => void;
    sisters: number; setSisters: (v: number) => void;
    hasPartner: boolean; setHasPartner: (v: boolean) => void;
    partnerSex: "male" | "female" | "unknown"; setPartnerSex: (v: "male" | "female" | "unknown") => void;
    sons: number; setSons: (v: number) => void;
    daughters: number; setDaughters: (v: number) => void;
    affectedFather: boolean; setAffectedFather: (v: boolean) => void;
    affectedMother: boolean; setAffectedMother: (v: boolean) => void;
    affectedPaternalGF: boolean; setAffectedPaternalGF: (v: boolean) => void;
    affectedPaternalGM: boolean; setAffectedPaternalGM: (v: boolean) => void;
    affectedMaternalGF: boolean; setAffectedMaternalGF: (v: boolean) => void;
    affectedMaternalGM: boolean; setAffectedMaternalGM: (v: boolean) => void;
    affectedBrothersCount: number; setAffectedBrothersCount: (v: number) => void;
    affectedSistersCount: number; setAffectedSistersCount: (v: number) => void;
    affectedPaternalUnclesCount: number; setAffectedPaternalUnclesCount: (v: number) => void;
    affectedPaternalAuntsCount: number; setAffectedPaternalAuntsCount: (v: number) => void;
    affectedMaternalUnclesCount: number; setAffectedMaternalUnclesCount: (v: number) => void;
    affectedMaternalAuntsCount: number; setAffectedMaternalAuntsCount: (v: number) => void;
    affectedSonsCount: number; setAffectedSonsCount: (v: number) => void;
    affectedDaughtersCount: number; setAffectedDaughtersCount: (v: number) => void;
  };
}) {
  return (
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
                    value={config.probandSex}
                    onChange={(e) => config.setProbandSex(e.target.value as any)}
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
                  checked={config.probandAffected}
                  onChange={(e) => config.setProbandAffected(e.target.checked)}
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
                  checked={config.hasPartner}
                  onChange={(e) => config.setHasPartner(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="has_partner" className="text-xs font-bold text-foreground select-none cursor-pointer">
                  Proband is Married or Has a Partner
                </label>
              </div>
            </div>

            {config.hasPartner && (
              <div className="space-y-5 pl-6 pt-4 border-t border-border/40 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block font-semibold">Spouse Biological Sex</label>
                  <div className="relative">
                    <select
                      value={config.partnerSex}
                      onChange={(e) => config.setPartnerSex(e.target.value as any)}
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
                  <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-foreground">Sons</div>
                        <div className="text-[10px] text-muted-foreground leading-normal">Number of biological sons</div>
                      </div>
                      <NumberInput value={config.sons} onChange={config.setSons} />
                    </div>
                    {config.sons > 0 && (
                      <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                        <div>
                          <div className="text-xs font-bold text-foreground font-semibold text-primary">Clinically Affected Sons</div>
                          <div className="text-[10px] text-muted-foreground leading-normal">How many biological sons are affected?</div>
                        </div>
                        <NumberInput value={config.affectedSonsCount} onChange={config.setAffectedSonsCount} max={config.sons} />
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-foreground">Daughters</div>
                        <div className="text-[10px] text-muted-foreground leading-normal">Number of biological daughters</div>
                      </div>
                      <NumberInput value={config.daughters} onChange={config.setDaughters} />
                    </div>
                    {config.daughters > 0 && (
                      <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                        <div>
                          <div className="text-xs font-bold text-foreground font-semibold text-primary">Clinically Affected Daughters</div>
                          <div className="text-[10px] text-muted-foreground leading-normal">How many biological daughters are affected?</div>
                        </div>
                        <NumberInput value={config.affectedDaughtersCount} onChange={config.setAffectedDaughtersCount} max={config.daughters} />
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
            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-foreground">Brothers</div>
                  <div className="text-[10px] text-muted-foreground leading-normal">Count of biological brothers</div>
                </div>
                <NumberInput value={config.brothers} onChange={config.setBrothers} />
              </div>
              {config.brothers > 0 && (
                <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                  <div>
                    <div className="text-xs font-bold text-foreground font-semibold text-primary">Clinically Affected Brothers</div>
                    <div className="text-[10px] text-muted-foreground leading-normal">How many brothers are affected?</div>
                  </div>
                  <NumberInput value={config.affectedBrothersCount} onChange={config.setAffectedBrothersCount} max={config.brothers} />
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-foreground">Sisters</div>
                  <div className="text-[10px] text-muted-foreground leading-normal">Count of biological sisters</div>
                </div>
                <NumberInput value={config.sisters} onChange={config.setSisters} />
              </div>
              {config.sisters > 0 && (
                <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                  <div>
                    <div className="text-xs font-bold text-foreground font-semibold text-primary">Clinically Affected Sisters</div>
                    <div className="text-[10px] text-muted-foreground leading-normal">How many sisters are affected?</div>
                  </div>
                  <NumberInput value={config.affectedSistersCount} onChange={config.setAffectedSistersCount} max={config.sisters} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Ancestors & Lineage */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-150">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Step 4: Ancestors & {config.generations === 2 ? "Parents" : "Paternal Lineage"}</h3>
            <p className="text-xs text-muted-foreground">
              {config.generations === 2 
                ? "Configure the biological parents of the Proband." 
                : "Configure the paternal lineage (Father's side) of the family."}
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground block">Ancestral Generations</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  config.setGenerations(2);
                  if (step > 4) setStep(4);
                }}
                className={`flex-1 py-3 px-4 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  config.generations === 2
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card hover:bg-accent text-muted-foreground"
                }`}
              >
                <span className="text-sm font-bold">Parents Only</span>
                <span className="text-[10px] opacity-75">2 generations total</span>
              </button>

              <button
                type="button"
                onClick={() => config.setGenerations(3)}
                className={`flex-1 py-3 px-4 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  config.generations === 3
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card hover:bg-accent text-muted-foreground"
                }`}
              >
                <span className="text-sm font-bold">Parents & Grandparents</span>
                <span className="text-[10px] opacity-75">3 generations total</span>
              </button>
            </div>
          </div>

          {config.generations === 2 ? (
            <div className="p-4 rounded-xl border border-border bg-card space-y-4">
              <span className="text-xs font-bold text-foreground block">Parents Affected Status</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-border/40 bg-muted/10 text-xs font-semibold text-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={config.affectedFather} onChange={(e) => config.setAffectedFather(e.target.checked)} className="rounded border-border h-4 w-4" />
                  <span>Mark Father as Affected</span>
                </label>
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-border/40 bg-muted/10 text-xs font-semibold text-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={config.affectedMother} onChange={(e) => config.setAffectedMother(e.target.checked)} className="rounded border-border h-4 w-4" />
                  <span>Mark Mother as Affected</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-3 border-t border-border/60">
              <div className="p-4 rounded-xl border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="inc_paternal"
                      checked={config.includePaternal}
                      onChange={(e) => config.setIncludePaternal(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <label htmlFor="inc_paternal" className="text-xs font-bold text-foreground select-none cursor-pointer">
                      Include Paternal Lineage (Father's side)
                    </label>
                  </div>
                </div>

                <div className="space-y-3.5 pl-6 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                  <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none font-semibold">
                    <input type="checkbox" checked={config.affectedFather} onChange={(e) => config.setAffectedFather(e.target.checked)} className="rounded border-border h-4 w-4" />
                    <span>Mark Father as Clinically Affected</span>
                  </label>

                  {config.includePaternal && (
                    <div className="space-y-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                      <span className="text-xs font-bold text-foreground block">Paternal Grandparents Affected Status</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                          <input type="checkbox" checked={config.affectedPaternalGF} onChange={(e) => config.setAffectedPaternalGF(e.target.checked)} className="rounded border-border h-4 w-4" />
                          <span>Pat. Grandfather</span>
                        </label>
                        <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                          <input type="checkbox" checked={config.affectedPaternalGM} onChange={(e) => config.setAffectedPaternalGM(e.target.checked)} className="rounded border-border h-4 w-4" />
                          <span>Pat. Grandmother</span>
                        </label>
                      </div>

                      <div className="space-y-4 pt-3 border-t border-border/40">
                        <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-foreground font-semibold">Father's Brothers (Uncles)</div>
                              <div className="text-[10px] text-muted-foreground leading-normal">Number of paternal uncles</div>
                            </div>
                            <NumberInput value={config.paternalUncles} onChange={config.setPaternalUncles} />
                          </div>
                          {config.paternalUncles > 0 && (
                            <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                              <div>
                                <div className="text-xs font-bold text-foreground font-semibold text-primary">Affected Paternal Uncles</div>
                                <div className="text-[10px] text-muted-foreground leading-normal">How many paternal uncles are affected?</div>
                              </div>
                              <NumberInput value={config.affectedPaternalUnclesCount} onChange={config.setAffectedPaternalUnclesCount} max={config.paternalUncles} />
                            </div>
                          )}
                        </div>

                        <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-foreground font-semibold">Father's Sisters (Aunts)</div>
                              <div className="text-[10px] text-muted-foreground leading-normal">Number of paternal aunts</div>
                            </div>
                            <NumberInput value={config.paternalAunts} onChange={config.setPaternalAunts} />
                          </div>
                          {config.paternalAunts > 0 && (
                            <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                              <div>
                                <div className="text-xs font-bold text-foreground font-semibold text-primary">Affected Paternal Aunts</div>
                                <div className="text-[10px] text-muted-foreground leading-normal">How many paternal aunts are affected?</div>
                              </div>
                              <NumberInput value={config.affectedPaternalAuntsCount} onChange={config.setAffectedPaternalAuntsCount} max={config.paternalAunts} />
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

      {/* Step 5: Maternal Lineage */}
      {step === 5 && config.generations === 3 && (
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
                    checked={config.includeMaternal}
                    onChange={(e) => config.setIncludeMaternal(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="inc_maternal" className="text-xs font-bold text-foreground select-none cursor-pointer">
                    Include Maternal Lineage (Mother's side)
                  </label>
                </div>
              </div>

              <div className="space-y-3.5 pl-6 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none font-semibold">
                  <input type="checkbox" checked={config.affectedMother} onChange={(e) => config.setAffectedMother(e.target.checked)} className="rounded border-border h-4 w-4" />
                  <span>Mark Mother as Clinically Affected</span>
                </label>

                {config.includeMaternal && (
                  <div className="space-y-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-foreground block">Maternal Grandparents Affected Status</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                        <input type="checkbox" checked={config.affectedMaternalGF} onChange={(e) => config.setAffectedMaternalGF(e.target.checked)} className="rounded border-border h-4 w-4" />
                        <span>Mat. Grandfather</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-xs text-foreground cursor-pointer select-none">
                        <input type="checkbox" checked={config.affectedMaternalGM} onChange={(e) => config.setAffectedMaternalGM(e.target.checked)} className="rounded border-border h-4 w-4" />
                        <span>Mat. Grandmother</span>
                      </label>
                    </div>

                    <div className="space-y-4 pt-3 border-t border-border/40">
                      <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-foreground font-semibold">Mother's Brothers (Uncles)</div>
                            <div className="text-[10px] text-muted-foreground leading-normal">Number of maternal uncles</div>
                          </div>
                          <NumberInput value={config.maternalUncles} onChange={config.setMaternalUncles} />
                        </div>
                        {config.maternalUncles > 0 && (
                          <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                            <div>
                              <div className="text-xs font-bold text-foreground font-semibold text-primary">Affected Maternal Uncles</div>
                              <div className="text-[10px] text-muted-foreground leading-normal">How many maternal uncles are affected?</div>
                            </div>
                            <NumberInput value={config.affectedMaternalUnclesCount} onChange={config.setAffectedMaternalUnclesCount} max={config.maternalUncles} />
                          </div>
                        )}
                      </div>

                      <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-foreground font-semibold">Mother's Sisters (Aunts)</div>
                            <div className="text-[10px] text-muted-foreground leading-normal">Number of maternal aunts</div>
                          </div>
                          <NumberInput value={config.maternalAunts} onChange={config.setMaternalAunts} />
                        </div>
                        {config.maternalAunts > 0 && (
                          <div className="flex items-center justify-between pl-4 pt-3 border-t border-border/40 animate-in fade-in duration-200">
                            <div>
                              <div className="text-xs font-bold text-foreground font-semibold text-primary">Affected Maternal Aunts</div>
                              <div className="text-[10px] text-muted-foreground leading-normal">How many maternal aunts are affected?</div>
                            </div>
                            <NumberInput value={config.affectedMaternalAuntsCount} onChange={config.setAffectedMaternalAuntsCount} max={config.maternalAunts} />
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
  );
}
