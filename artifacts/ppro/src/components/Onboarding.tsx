import { useState, useEffect } from "react";
import { useCreateProfile } from "@workspace/api-client-react";
import { Shield, Lock, User, KeyRound, Sparkles, ArrowRight, ArrowLeft, Check, Loader2, ChevronsUpDown, Dna } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Onboarding() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState("Clinical Geneticist");
  const [customRole, setCustomRole] = useState("");
  const [creationStarted, setCreationStarted] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const createProfile = useCreateProfile();

  const handleNextToStep2 = () => setStep(2);
  const handleBackToStep1 = () => setStep(1);

  const handleCreateProfile = () => {
    if (!name.trim()) return;
    setStep(3);
    setCreationStarted(true);
  };

  useEffect(() => {
    if (creationStarted && !createProfile.isPending && !createProfile.isSuccess && !createProfile.isError) {
      createProfile.mutate(
        {
          display_name: name.trim(),
          role_label: selectedRole === "Other Specialist" ? customRole.trim() : selectedRole
        },
        {
          onSuccess: (data) => {
            setPublicKey(data.public_key);
          },
          onError: () => {
            setCreationStarted(false);
            setStep(2);
          },
        }
      );
    }
  }, [creationStarted, name, selectedRole, customRole, createProfile]);

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full filter blur-[80px] -z-10 animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/5 rounded-full filter blur-[80px] -z-10 animate-pulse duration-[6000ms]" />

      <div className="w-full max-w-xl border border-border bg-card rounded-2xl shadow-2xl p-8 flex flex-col items-center justify-between relative overflow-hidden transition-all duration-300">
        
        {/* Step Indicator */}
        <div className="flex items-center gap-1.5 mb-8">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 3 ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`} />
        </div>

        {/* Step 1: Welcome Screen */}
        {step === 1 && (
          <div className="w-full flex-1 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="w-16 h-16 rounded-2xl bg-primary/[0.08] flex items-center justify-center mb-6 shadow-md shadow-primary/4 p-3.5">
              <Dna className="w-full h-full text-primary animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome to Pedigree PRO
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md">
              A modern, offline-first clinical pedigree editor designed for Genomic researchers and Healthcare professionals.
            </p>

            <div className="w-full space-y-4 my-8 text-left max-w-md">
              <div className="flex gap-4 p-3 rounded-lg border border-border/55 bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">100% Local Privacy</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your data is saved securely on your local computer. There are no cloud servers, and your patients' sensitive files are never transferred over the internet.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-3 rounded-lg border border-border/55 bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Secure Access Control</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your profile is secured on your device, ensuring your edits are properly saved and allowing you to make safe backups without needing complex passwords.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-3 rounded-lg border border-border/55 bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Private Collaborative Sharing</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share pedigrees securely with other colleagues. The files are locked so that only the recipient you choose can open and view them.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={handleNextToStep2} className="w-full max-w-md gap-2" size="lg">
              Set Up Profile
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Form Input */}
        {step === 2 && (
          <div className="w-full flex-1 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
              <User className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground text-center">
              Create Your Profile
            </h2>
            <p className="text-muted-foreground text-xs text-center mt-1 max-w-sm">
              Your profile attributes your pedigree saves, organizes patient folders, and secures your local data file.
            </p>

            <div className="w-full space-y-4 my-8 max-w-md text-left">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                  placeholder="Dr. Sarah Chen"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Role / Specialty
                </label>
                <div className="relative">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg pl-3 pr-10 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="Clinical Geneticist">Clinical Geneticist</option>
                    <option value="Genetic Counselor">Genetic Counselor</option>
                    <option value="Rare Disease Specialist">Rare Disease Specialist</option>
                    <option value="Pedigree Analyst">Pedigree Analyst</option>
                    <option value="Medical Oncologist">Medical Oncologist</option>
                    <option value="Pediatrician">Pediatrician</option>
                    <option value="Research Fellow">Research Fellow</option>
                    <option value="Other Specialist">Other Specialist</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground/60">
                    <ChevronsUpDown className="w-4 h-4" />
                  </div>
                </div>

                {selectedRole === "Other Specialist" && (
                  <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                      Custom Specialty / Role
                    </label>
                    <input
                      type="text"
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                      placeholder="e.g. Cardiologist"
                      required
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="w-full max-w-md flex gap-3">
              <Button variant="outline" onClick={handleBackToStep1} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                onClick={handleCreateProfile}
                disabled={!name.trim() || (selectedRole === "Other Specialist" && !customRole.trim())}
                className="flex-1 gap-2"
              >
                Create My Profile
                <KeyRound className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Key Generation & Completion */}
        {step === 3 && (
          <div className="w-full flex-1 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            {createProfile.isPending ? (
              <>
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-8 relative">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <KeyRound className="w-4 h-4 text-primary absolute" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Securing Your Workspace...
                </h2>
                <p className="text-muted-foreground text-xs mt-3 max-w-xs leading-normal">
                  Creating your secure profile and setting up your local database. This happens completely on your device.
                </p>
              </>
            ) : createProfile.isSuccess ? (
              <>
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Profile Successfully Created!
                </h2>
                <p className="text-muted-foreground text-xs mt-1.5 max-w-xs">
                  Your secure profile is now active. Your sharing key is listed below:
                </p>

                <div className="w-full max-w-md my-6 p-3 bg-muted rounded-lg border border-border flex flex-col items-start gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Your Public Sharing Key
                  </span>
                  <code className="text-[11px] font-mono text-muted-foreground text-left break-all select-all">
                    {publicKey ?? "Generating..."}
                  </code>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-[10px] text-left leading-relaxed text-amber-600 dark:text-amber-400 max-w-md mb-8">
                  <Lock className="w-3.5 h-3.5 text-amber-500 inline mr-1.5 shrink-0" />
                  All keys and records are stored directly on this device. Do not clear browser site data or cookies without saving pedigree exports, as your data is kept locally.
                </div>

                <Button
                  onClick={() => {
                    // Triggers the state update by reloading,
                    // which causes the router to recheck and enter the app.
                    window.location.reload();
                  }}
                  className="w-full max-w-md gap-2"
                  size="lg"
                >
                  Enter Pedigree PRO
                  <Sparkles className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                  <Lock className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-destructive">
                  Generation Failed
                </h2>
                <p className="text-muted-foreground text-sm mt-2">
                  There was an error creating your profile. Please try again.
                </p>
                <Button onClick={() => setStep(2)} className="mt-6">
                  Retry
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
