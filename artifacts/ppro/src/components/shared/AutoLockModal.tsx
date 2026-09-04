import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AutoLockModalProps {
  isOpen: boolean;
  onUnlock: () => void;
}

/**
 * AutoLockModal — Workstation Privacy Screen
 *
 * Obscures clinical diagrams and patient records upon detected user inactivity
 * to prevent shoulder-surfing in clinic and lab environments.
 */
export function AutoLockModal({ isOpen, onUnlock }: AutoLockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-background/95 backdrop-blur-md px-4">
      <div className="max-w-md w-full p-8 rounded-xl border border-border bg-card shadow-2xl text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5 text-primary">
          <Lock className="w-8 h-8" />
        </div>
        
        <h2 className="text-xl font-bold text-foreground mb-2">Workstation Privacy Lock</h2>
        <p className="text-xs text-muted-foreground mb-6 max-w-sm">
          Pedigree PRO display obscured due to inactivity to protect patient privacy and clinical records from shoulder-surfing.
        </p>

        <div className="w-full flex items-center justify-center gap-2 py-2 px-3 mb-6 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span>Local session preserved & encrypted</span>
        </div>

        <Button
          onClick={onUnlock}
          className="w-full font-bold uppercase tracking-wider text-xs py-5"
        >
          Resume Session
        </Button>
      </div>
    </div>
  );
}
