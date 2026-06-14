import { useState, useEffect } from "react";
import { X, ArrowRight, ArrowLeft, Dna, Keyboard, HelpCircle, ShieldAlert, Sparkles, Check } from "lucide-react";

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
      title: "Welcome to Pedigree PRO",
      desc: "An advanced, zero-server clinical pedigree editor designed for genomics researchers and healthcare professionals.",
      icon: <Sparkles className="w-8 h-8 text-primary animate-pulse" />,
      color: "text-primary",
      bgColor: "bg-primary/10",
      features: [
        { title: "100% Offline Privacy", desc: "No databases, servers, or cloud storage. Your patient data is saved completely on your local device." },
        { title: "Cryptographic Security", desc: "Local profiles are locked on-device using AES-256 and PBKDF2 encryption keys." },
        { title: "Responsive Canvas", desc: "Fluid, high-performance canvas that supports keyboard panning, trackpad zoom, and smart auto-layouts." }
      ]
    },
    {
      title: "Interactive Drawing & Shortcuts",
      desc: "Speed up your clinical workflow using rapid keyboard shortcuts and mouse gestures.",
      icon: <Keyboard className="w-8 h-8 text-indigo-500" />,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
      features: [
        { title: "Keyboard Quick-Add", desc: "Select a node, then press: M (add mother), F (add father), U (add partner), S (add sibling)." },
        { title: "Relation Lines", desc: "Hold Ctrl and drag from a node to extend relationship links or connect couples instantly." },
        { title: "Auto-Arrange layout", desc: "Press 'L' or toggle 'Live Layout' in settings to auto-arrange coordinates in real-time." }
      ]
    },
    {
      title: "Smart Segregation & Genotypes",
      desc: "Track familial disease variants and genotype carrier details directly under pedigree nodes.",
      icon: <Dna className="w-8 h-8 text-teal-500" />,
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
      features: [
        { title: "Custom Sizing & Offsets", desc: "Configure genotype text size (8px-24px) and symbol offset directly in the Canvas Settings." },
        { title: "Harmonized Colors", desc: "Set individual hex colors for mutant (+), wild-type (-), and separator (/) symbols." },
        { title: "Quick Genotype Presets", desc: "Select common genotype combinations (+/-, +/+, -/-) in the Properties or Quick Edit Popover." }
      ]
    },
    {
      title: "Clinical Risk & Validation",
      desc: "Employ built-in clinical intelligence checks to ensure pedigree logic correctness.",
      icon: <ShieldAlert className="w-8 h-8 text-amber-500" />,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      features: [
        { title: "Risk Calculator", desc: "Compute genetic inheritance risks (Autosomal Dominant, Recessive, X-linked) relative to any selected node." },
        { title: "Validation Engine", desc: "Spot clinical contradictions (e.g. generations overlaps, invalid parent ages, cycles) in real-time." },
        { title: "Interactive Focus", desc: "Click any issue item inside the validation sidebar to jump directly to the target node." }
      ]
    },
    {
      title: "Secure Sharing & WebRTC LAN",
      desc: "Collaborate privately without leaving your local local-area network (LAN).",
      icon: <HelpCircle className="w-8 h-8 text-emerald-500" />,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      features: [
        { title: "Encrypted Sharing", desc: "Export credentials as secure hybrid-encrypted envelopes, locked for specific recipients." },
        { title: "WebRTC Peer Sharing", desc: "Direct browser-to-browser WebRTC transfers over your local network — no internet required." },
        { title: "Timeline History", desc: "Access the Version Timeline to view historical drafts, perform visual diffs, and restore old saves." }
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
