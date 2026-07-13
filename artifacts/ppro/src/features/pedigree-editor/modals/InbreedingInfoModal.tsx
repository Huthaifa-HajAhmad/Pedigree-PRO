import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Info, BookOpen, ExternalLink, Activity } from "lucide-react";

interface InbreedingInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InbreedingInfoModal({ open, onOpenChange }: InbreedingInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border/80 max-w-lg bg-background/95 backdrop-blur-lg shadow-2xl rounded-xl p-5 space-y-4 text-foreground focus:outline-none">
        <DialogHeader className="space-y-1.5 pb-2 border-b border-border/50">
          <DialogTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-primary">
            <Activity className="w-4 h-4 text-primary" />
            Coefficient of Inbreeding (F)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Clinical utility and reference guidelines for consanguineous relationships.
          </DialogDescription>
        </DialogHeader>

        {/* What is F */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-primary" />
            What is the Inbreeding Coefficient (F)?
          </h4>
          <p className="text-xs text-foreground/90 leading-relaxed">
            The Coefficient of Inbreeding (<span className="font-semibold text-primary">F</span>) measures the probability that a person inherits two copies of the same gene variant (allele) from a common ancestor (known as being **Identical by Descent** or **IBD**). It represents the estimated percentage of the individual's entire genome that is homozygous due to consanguinity.
          </p>
        </div>

        {/* Relationship Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Relationship Benchmarks
          </h4>
          <div className="border border-border/80 rounded-lg overflow-hidden text-xs bg-card">
            <div className="grid grid-cols-2 bg-muted/65 px-3 py-1.5 font-semibold text-muted-foreground border-b border-border/60">
              <span>Relationship Type</span>
              <span className="text-right">Coefficient (F)</span>
            </div>
            <div className="divide-y divide-border/40">
              <div className="grid grid-cols-2 px-3 py-1.5 hover:bg-muted/20">
                <span>1st-Degree (Parent-Child, Full Siblings)</span>
                <span className="text-right font-mono font-semibold text-foreground">25.00% (1/4)</span>
              </div>
              <div className="grid grid-cols-2 px-3 py-1.5 hover:bg-muted/20">
                <span>2nd-Degree (Uncle-Niece, Half-Siblings)</span>
                <span className="text-right font-mono font-semibold text-foreground">12.50% (1/8)</span>
              </div>
              <div className="grid grid-cols-2 px-3 py-1.5 hover:bg-muted/20">
                <span>1st Cousins</span>
                <span className="text-right font-mono font-semibold text-foreground">6.25% (1/16)</span>
              </div>
              <div className="grid grid-cols-2 px-3 py-1.5 hover:bg-muted/20">
                <span>1st Cousins Once Removed</span>
                <span className="text-right font-mono font-semibold text-foreground">3.125% (1/32)</span>
              </div>
              <div className="grid grid-cols-2 px-3 py-1.5 hover:bg-muted/20">
                <span>2nd Cousins</span>
                <span className="text-right font-mono font-semibold text-foreground">1.56% (1/64)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Significance */}
        <div className="space-y-1.5 bg-muted/20 p-2.5 rounded-lg border border-border/40">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Clinical Significance
          </h4>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Consanguinity increases the chance that offspring will inherit a disease-causing recessive gene variant from both parents, causing a rare autosomal recessive genetic disorder. For first cousins with a baseline <span className="font-semibold text-foreground">F = 6.25%</span> and no prior family history, the risk of congenital anomalies or recessive disorders is estimated to be about <span className="font-semibold text-foreground">1.7% to 2.8%</span> above the general population risk of 3-4%.
          </p>
        </div>

        {/* Citations */}
        <div className="space-y-2 border-t border-border/50 pt-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            Evidence & Guidelines References
          </h4>
          <div className="space-y-2">
            {/* Wright */}
            <div className="text-[11px] leading-relaxed border-l-2 border-primary/40 pl-2">
              <div className="font-semibold text-foreground">Wright, Sewall (1922)</div>
              <div className="text-muted-foreground">
                "Coefficients of inbreeding and relationship." *The American Naturalist*, 56(645), 330–338.
              </div>
              <a 
                href="https://doi.org/10.1086/279872" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-0.5 text-primary hover:underline text-[10px] mt-0.5"
              >
                DOI: 10.1086/279872 <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            {/* Bennett */}
            <div className="text-[11px] leading-relaxed border-l-2 border-primary/40 pl-2">
              <div className="font-semibold text-foreground">Bennett, R. L., et al. (2021)</div>
              <div className="text-muted-foreground">
                "Consanguineous couples: Recommendations for genetic counseling and clinical screening." *Journal of Genetic Counseling*, 30(4), 957-976.
              </div>
              <a 
                href="https://doi.org/10.1002/jgc4.1421" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-0.5 text-primary hover:underline text-[10px] mt-0.5"
              >
                DOI: 10.1002/jgc4.1421 <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
