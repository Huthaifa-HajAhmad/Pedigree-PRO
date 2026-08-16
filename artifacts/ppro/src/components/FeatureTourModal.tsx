import { useState, useEffect } from "react";
import { X, ArrowRight, ArrowLeft, ShieldAlert, Sparkles, Check, Plus, Activity, Grid } from "lucide-react";

interface FeatureTourModalProps {
  open: boolean;
  onClose: () => void;
}

interface Slide {
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  features: { title: string; desc: string }[];
}

export function FeatureTourModal({ open, onClose }: FeatureTourModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (open) setCurrentSlide(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && currentSlide < slides.length - 1) setCurrentSlide(prev => prev + 1);
      if (e.key === "ArrowLeft" && currentSlide > 0) setCurrentSlide(prev => prev - 1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentSlide, onClose]);

  if (!open) return null;

  const slides: Slide[] = [
    {
      title: "Welcome to the Canvas Editor",
      desc: "Learn how to use the editor toolbar and canvas interaction tools to build family trees quickly.",
      icon: <Sparkles className="w-8 h-8 text-primary animate-pulse" />,
      color: "text-primary",
      bgColor: "bg-primary/10",
      features: [
        { title: "Dynamic Canvas", desc: "Zoom with trackpad pinch or Ctrl + mouse wheel, drag the canvas while holding Space, or toggle snap guides." },
        { title: "Version Timeline", desc: "Save historical drafts with the save button or auto-saving, and restore them using the Version Timeline." },
        { title: "Canvas Settings", desc: "Customize node border colors, default spacing gaps, and toggle generation labels in the Canvas Settings sidebar." }
      ]
    },
    {
      title: "Tool: Adding Symbols",
      desc: "Use the left-most group of tools on the toolbar to add nodes or customize patient phenotypes.",
      icon: <Plus className="w-8 h-8 text-indigo-500" />,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      features: [
        { title: "Symbol Quick-Add", desc: "Click Male, Female, or Unknown to place a node, or use keybinds: M (Mother), F (Father), U (Partner), S (Sibling)." },
        { title: "Clinical Status", desc: "Select a node to toggle Affected, Carrier, Deceased, or Proband status from the Properties sidepanel." },
        { title: "Quick Annotations", desc: "Double-click any empty canvas space to create a text annotation, or drag to position them relative to nodes." }
      ]
    },
    {
      title: "Tool: Linking Relationships",
      desc: "Toggle relationship linking modes on the toolbar to create couple or parent-child lines.",
      icon: <Activity className="w-8 h-8 text-teal-500" />,
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
      features: [
        { title: "Connection Tool", desc: "Select a link type (Couple, Parent-Child, Consanguinity) and click the source and destination symbols." },
        { title: "Twin Tool", desc: "Click the Twin button, select two siblings, and designate them as Identical or Fraternal twins." },
        { title: "Keyboard Linking", desc: "Hold Ctrl and drag from one symbol to another to quickly draw relationship lines." }
      ]
    },
    {
      title: "Tool: Layout & Spacing",
      desc: "Use smart layout tools on the toolbar to align coordinates and resolve node overlaps automatically.",
      icon: <Grid className="w-8 h-8 text-amber-500" />,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      features: [
        { title: "Auto-Layout", desc: "Click the 'Auto-Layout' button (or press `L`) to re-arrange nodes cleanly according to clinical standards." },
        { title: "Live Layout", desc: "Enable 'Live Layout' from settings to automatically re-route and position symbols as you draw." },
        { title: "Generation Rail", desc: "Drag the vertical Roman numeral rail on the left to adjust horizontal positioning offset." }
      ]
    },
    {
      title: "Tool: Diagnostics & Sharing",
      desc: "Analyze pedigree health and collaborate securely using clinical panel options.",
      icon: <ShieldAlert className="w-8 h-8 text-emerald-500" />,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      features: [
        { title: "Validation Panel", desc: "Check real-time clinical errors (e.g. gender conflicts, generational cycles) and focus directly on problem nodes." },
        { title: "Risk Calculator", desc: "Select any node as an index patient to compute Autosomal Dominant or Recessive inheritance risk probabilities." },
        { title: "Secure Sharing", desc: "Hybrid-encrypt pedigrees via zero-knowledge relay links or export reports in PDF, PPTX, PNG, and native formats." }
      ]
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("ppro_feature_tour_seen", "true");
    onClose();
  };

  const slide = slides[currentSlide]!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg border border-border bg-card rounded-2xl shadow-2xl p-6 flex flex-col items-center justify-between relative overflow-hidden transition-all duration-300"
        style={{ minHeight: "460px" }}
      >
        {/* Top ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-primary/10 rounded-full filter blur-[40px] -z-10" />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleComplete}
          aria-label="Skip Tour"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 hover:bg-accent rounded-md transition-all focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Indicator */}
        <div className="flex items-center gap-1.5 mb-6">
          {slides.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => setCurrentSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
            />
          ))}
        </div>

        {/* Content Area */}
        <div className="w-full flex-1 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className={`w-14 h-14 rounded-2xl ${slide.bgColor} flex items-center justify-center mb-4 shadow-sm`}>
            {slide.icon}
          </div>
          
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {slide.title}
          </h2>
          
          <p className="text-muted-foreground text-xs mt-1.5 max-w-sm leading-normal">
            {slide.desc}
          </p>

          {/* Features Checklist */}
          <div className="w-full space-y-3 my-5 text-left max-w-sm">
            {slide.features.map((f, idx) => (
              <div key={idx} className="flex gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/10">
                <div className={`w-5 h-5 rounded-full ${slide.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Check className={`w-3 h-3 ${slide.color}`} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-foreground leading-snug">{f.title}</h4>
                  <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Actions */}
        <div className="w-full flex gap-3 max-w-sm mt-2">
          {currentSlide > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-border bg-card hover:bg-accent text-xs font-semibold rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              className="flex items-center justify-center px-4 py-2 border border-border bg-card hover:bg-accent text-xs font-semibold rounded-lg text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
            >
              Skip
            </button>
          )}
          
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {currentSlide === slides.length - 1 ? "Finish Tour" : "Next Step"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
