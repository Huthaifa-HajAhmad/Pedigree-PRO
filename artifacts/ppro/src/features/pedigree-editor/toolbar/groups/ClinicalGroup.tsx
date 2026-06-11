import { useState } from "react";
import { LayoutTemplate, TrendingUp, AlertTriangle, ShieldCheck, BookOpen, Clock, Plus, Trash2, ArrowLeft } from "lucide-react";
import type { CanvasData } from "@/features/pedigree-editor/canvas/types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDraggable } from "@/hooks/use-draggable";

import { TemplateOption } from "@/features/pedigree-editor/utils/templates";

interface ValidationSummary {
  errorCount: number;
  warningCount: number;
}

interface ClinicalGroupProps {
  showTemplates: boolean;
  setShowTemplates: (v: boolean) => void;
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
  canvasNodes: any[];
  openConfirm: (title: string, message: string, onConfirm: () => void) => void;
  labelHidden?: boolean;
  onClearSelection?: () => void;
}

const getTemplateSvg = (key: string) => {
  if (key === "nuclear") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="25" y="12" width="12" height="12" rx="1" />
        <circle cx="71" cy="18" r="6" />
        <line x1="37" y1="18" x2="65" y2="18" />
        <line x1="51" y1="18" x2="51" y2="35" />
        <path d="M51 35 L57 41 L51 47 L45 41 Z" />
        <path d="M39 47 L45 42 M41 42 L45 42 L45 46" strokeWidth="1.5" />
      </svg>
    );
  }
  if (key === "three-gen") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="10" y="8" width="8" height="8" rx="0.5" />
        <circle cx="28" cy="12" r="4" />
        <line x1="18" y1="12" x2="24" y2="12" />
        <line x1="21" y1="12" x2="21" y2="22" />

        <rect x="72" y="8" width="8" height="8" rx="0.5" />
        <circle cx="90" cy="12" r="4" />
        <line x1="80" y1="12" x2="86" y2="12" />
        <line x1="83" y1="12" x2="83" y2="22" />

        <rect x="17" y="22" width="8" height="8" rx="0.5" />
        <circle cx="83" cy="26" r="4" />
        <line x1="25" y1="26" x2="79" y2="26" />
        <line x1="52" y1="26" x2="52" y2="40" />

        <path d="M52 40 L57 45 L52 50 L47 45 Z" />
        <path d="M41 51 L47 46 M43 46 L47 46 L47 50" strokeWidth="1.2" />
      </svg>
    );
  }
  if (key === "affected-siblings") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="34" y="10" width="10" height="10" rx="0.5" />
        <circle cx="66" cy="15" r="5" />
        <line x1="44" y1="15" x2="61" y2="15" />
        <line x1="52.5" y1="15" x2="52.5" y2="26" />
        <line x1="25" y1="26" x2="80" y2="26" />
        <line x1="25" y1="26" x2="25" y2="36" />
        <line x1="52.5" y1="26" x2="52.5" y2="36" />
        <line x1="80" y1="26" x2="80" y2="36" />

        <rect x="20" y="36" width="10" height="10" rx="0.5" />
        <path d="M52.5 36 L57.5 41 L52.5 46 L47.5 41 Z" fill="currentColor" />
        <circle cx="80" cy="41" r="5" fill="currentColor" />
      </svg>
    );
  }
  if (key === "consanguineous") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="25" y="12" width="12" height="12" rx="1" />
        <circle cx="71" cy="18" r="6" />
        <line x1="37" y1="16" x2="65" y2="16" />
        <line x1="37" y1="20" x2="65" y2="20" />
        <line x1="51" y1="18" x2="51" y2="35" />
        <path d="M51 35 L57 41 L51 47 L45 41 Z" />
      </svg>
    );
  }
  if (key === "cousin-marriage") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        {/* Shared Grandparents */}
        <rect x="42" y="5" width="8" height="8" rx="0.5" />
        <circle cx="58" cy="9" r="4" />
        <line x1="50" y1="9" x2="54" y2="9" />
        <line x1="52" y1="9" x2="52" y2="18" />
        <line x1="34" y1="18" x2="70" y2="18" />
        <line x1="34" y1="18" x2="34" y2="24" />
        <line x1="70" y1="18" x2="70" y2="24" />

        {/* Siblings & Spouses */}
        <rect x="30" y="24" width="8" height="8" rx="0.5" />
        <circle cx="16" cy="28" r="4" />
        <line x1="20" y1="28" x2="30" y2="28" />
        <line x1="25" y1="28" x2="25" y2="36" />

        <circle cx="70" cy="28" r="4" />
        <rect x="84" y="24" width="8" height="8" rx="0.5" />
        <line x1="74" y1="28" x2="84" y2="28" />
        <line x1="79" y1="28" x2="79" y2="36" />

        {/* Cousin Marriage (consanguinity double line) */}
        <rect x="21" y="36" width="8" height="8" rx="0.5" />
        <circle cx="75" cy="40" r="4" />
        <line x1="29" y1="38" x2="71" y2="38" />
        <line x1="29" y1="42" x2="71" y2="42" />
        <line x1="50" y1="40" x2="50" y2="50" />

        {/* Proband Child */}
        <path d="M50 50 L54 54 L50 58 L46 54 Z" />
      </svg>
    );
  }
  if (key === "dominant-transmission") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" />
        <circle cx="42" cy="24" r="4" fill="currentColor" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <path d="M38 38 L42 42 L38 46 L34 42 Z" fill="currentColor" />
        <circle cx="66" cy="42" r="4" />
      </svg>
    );
  }
  if (key === "recessive-transmission") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" />
        <circle cx="42" cy="24" r="4" />
        <circle cx="42" cy="24" r="1.2" fill="currentColor" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <circle cx="62" cy="24" r="1.2" fill="currentColor" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <path d="M38 38 L42 42 L38 46 L34 42 Z" fill="currentColor" />
        <circle cx="66" cy="42" r="4" />
        <circle cx="66" cy="42" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (key === "x-linked-carrier") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" />
        <circle cx="42" cy="24" r="4" />
        <circle cx="42" cy="24" r="1.2" fill="currentColor" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <rect x="34" y="38" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="66" cy="42" r="4" />
        <circle cx="66" cy="42" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (key === "x-linked-dominant") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" />
        <circle cx="42" cy="24" r="4" fill="currentColor" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <path d="M38 38 L42 42 L38 46 L34 42 Z" fill="currentColor" />
        <circle cx="66" cy="42" r="4" fill="currentColor" />
      </svg>
    );
  }
  if (key === "mitochondrial-transmission") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" />
        <circle cx="50" cy="10" r="4" fill="currentColor" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="42" cy="24" r="4" fill="currentColor" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <path d="M38 38 L42 42 L38 46 L34 42 Z" fill="currentColor" />
        <circle cx="66" cy="42" r="4" fill="currentColor" />
      </svg>
    );
  }
  if (key === "y-linked-transmission") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="42" cy="24" r="4" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" fill="currentColor" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <rect x="34" y="38" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="66" cy="42" r="4" />
      </svg>
    );
  }
  if (key === "incomplete-penetrance") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="42" cy="24" r="4" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <path d="M38 38 L42 42 L38 46 L34 42 Z" fill="currentColor" />
        <circle cx="66" cy="42" r="4" />
      </svg>
    );
  }
  if (key === "imprinting-paternal") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" />
        <circle cx="42" cy="24" r="4" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <path d="M38 38 L42 42 L38 46 L34 42 Z" fill="currentColor" />
        <circle cx="66" cy="42" r="4" />
      </svg>
    );
  }
  if (key === "imprinting-maternal") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="42" cy="24" r="4" fill="currentColor" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <path d="M38 38 L42 42 L38 46 L34 42 Z" />
        <circle cx="66" cy="42" r="4" fill="currentColor" />
      </svg>
    );
  }
  if (key === "pseudodominance") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" fill="currentColor" />
        <circle cx="42" cy="24" r="4" />
        <circle cx="42" cy="24" r="1.2" fill="currentColor" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <circle cx="62" cy="24" r="1.2" fill="currentColor" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <path d="M38 38 L42 42 L38 46 L34 42 Z" fill="currentColor" />
        <circle cx="66" cy="42" r="4" />
        <circle cx="66" cy="42" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (key === "germline-mosaicism") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="34" y="12" width="10" height="10" rx="0.5" />
        <circle cx="66" cy="17" r="5" />
        <line x1="44" y1="17" x2="61" y2="17" />
        <line x1="52.5" y1="17" x2="52.5" y2="28" />
        <line x1="25" y1="28" x2="80" y2="28" />
        <line x1="25" y1="28" x2="25" y2="38" />
        <line x1="52.5" y1="28" x2="52.5" y2="38" />
        <line x1="80" y1="28" x2="80" y2="38" />
        <rect x="20" y="38" width="10" height="10" rx="0.5" fill="currentColor" />
        <path d="M52.5 38 L57.5 43 L52.5 48 L47.5 43 Z" fill="currentColor" />
        <circle cx="80" cy="43" r="5" />
      </svg>
    );
  }
  if (key === "de-novo") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="30" y="6" width="8" height="8" rx="0.5" />
        <circle cx="50" cy="10" r="4" />
        <line x1="38" y1="10" x2="46" y2="10" />
        <line x1="42" y1="10" x2="42" y2="18" />
        <line x1="22" y1="18" x2="42" y2="18" />
        <line x1="22" y1="18" x2="22" y2="20" />
        <line x1="42" y1="18" x2="42" y2="20" />
        <rect x="18" y="20" width="8" height="8" rx="0.5" />
        <circle cx="42" cy="24" r="4" />
        <rect x="58" y="20" width="8" height="8" rx="0.5" />
        <line x1="46" y1="24" x2="58" y2="24" />
        <line x1="52" y1="24" x2="52" y2="34" />
        <line x1="38" y1="34" x2="66" y2="34" />
        <line x1="38" y1="34" x2="38" y2="38" />
        <line x1="66" y1="34" x2="66" y2="38" />
        <path d="M38 38 L42 42 L38 46 L34 42 Z" fill="currentColor" />
        <circle cx="66" cy="42" r="4" />
      </svg>
    );
  }
  if (key === "twins-template") {
    return (
      <svg className="w-16 h-12 text-slate-700 dark:text-slate-300" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="32" y="8" width="10" height="10" rx="0.5" />
        <circle cx="68" cy="13" r="5" />
        <line x1="42" y1="13" x2="63" y2="13" />
        <line x1="52.5" y1="13" x2="52.5" y2="24" />
        
        {/* MZ twins branch */}
        <line x1="52.5" y1="24" x2="30" y2="40" />
        <line x1="52.5" y1="24" x2="48" y2="40" />
        <line x1="38" y1="30" x2="42" y2="30" />
        <rect x="25" y="40" width="10" height="10" rx="0.5" />
        <rect x="43" y="40" width="10" height="10" rx="0.5" />

        {/* DZ twins branch */}
        <line x1="52.5" y1="24" x2="65" y2="40" />
        <line x1="52.5" y1="24" x2="80" y2="40" />
        <circle cx="65" cy="45" r="5" />
        <circle cx="80" cy="45" r="5" />
      </svg>
    );
  }
  return null;
};

export function ClinicalGroup({
  showTemplates, setShowTemplates, showRiskPanel, setShowRiskPanel,
  showValidation, setShowValidation, showLegend, setShowLegend,
  validation, templates, buildTemplate, updateCanvas, canvasNodes, openConfirm, labelHidden = false,
  onClearSelection,
}: ClinicalGroupProps) {

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);

  const canvasNodesLength = canvasNodes.length;

  const { position, onPointerDown } = useDraggable();

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

  const categories = [
    { id: "all", label: "All Templates", icon: <LayoutTemplate className="w-4 h-4" /> },
    { id: "basic", label: "Basic Structures", icon: <BookOpen className="w-4 h-4" /> },
    { id: "consanguinity", label: "Consanguinity", icon: <AlertTriangle className="w-4 h-4" /> },
    { id: "inheritance", label: "Inheritance Patterns", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "special", label: "Special Layouts", icon: <Clock className="w-4 h-4" /> },
  ];

  const filteredTemplates = templates.filter((tpl) => {
    if (activeCategory === "all") return true;
    return tpl.category === activeCategory;
  });

  const handleLoadReplace = (key: string) => {
    const data = buildTemplate(key);
    updateCanvas(() => data);
    setShowTemplates(false);
    setSelectedTemplateKey(null);
  };

  const handleLoadAppend = (key: string) => {
    const tplData = buildTemplate(key);
    if (tplData.nodes.length === 0) return;

    // Calculate maximum X of existing nodes to shift template nodes to the right
    const maxX = canvasNodes.reduce((max, node) => Math.max(max, node.x), 0);
    // Find left-most node X in the template
    const minTemplateX = tplData.nodes.reduce((min, n) => Math.min(min, n.x), Infinity);
    const shiftX = (canvasNodes.length > 0 ? maxX : 0) + 150 - (minTemplateX !== Infinity ? minTemplateX : 0);

    const shiftedNodes = tplData.nodes.map(n => ({
      ...n,
      x: Math.round(n.x + shiftX)
    }));

    updateCanvas((prev) => ({
      nodes: [...prev.nodes, ...shiftedNodes],
      edges: [...prev.edges, ...tplData.edges],
      annotations: [...(prev.annotations || []), ...(tplData.annotations || [])]
    }));

    setShowTemplates(false);
    setSelectedTemplateKey(null);
  };

  const handleCloseDialog = () => {
    setShowTemplates(false);
    setSelectedTemplateKey(null);
  };

  return (
    <div className="flex flex-col justify-between h-full border-r border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex-1 flex items-center gap-1">
        <button
          type="button"
          data-testid="button-templates"
          onClick={() => { setShowTemplates(true); }}
          title="Pedigree templates"
          aria-label="Pedigree templates"
          aria-expanded={showTemplates}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${
            showTemplates ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <LayoutTemplate className="w-5 h-5" />
          <span>Templates</span>
        </button>
        <button
          type="button"
          data-testid="button-risk"
          onClick={handleRiskToggle}
          title="Risk calculator panel"
          aria-label="Risk calculator panel"
          aria-pressed={showRiskPanel}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${
            showRiskPanel ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          <span>Risk</span>
        </button>
        <button
          type="button"
          data-testid="button-validate"
          onClick={handleValidationToggle}
          title="Pedigree validation"
          aria-label="Pedigree validation"
          aria-pressed={showValidation}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${
            showValidation ? "bg-primary/10 text-primary"
            : validation.errorCount > 0 ? "text-destructive bg-destructive/10"
            : validation.warningCount > 0 ? "text-orange-400 bg-orange-400/10"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          {validation.errorCount > 0 ? <AlertTriangle className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          <span>
            {validation.errorCount > 0 ? `${validation.errorCount} Err` : validation.warningCount > 0 ? `${validation.warningCount} Warn` : "Valid"}
          </span>
        </button>
        <button
          type="button"
          data-testid="button-legend"
          onClick={() => setShowLegend((v) => !v)}
          title="Toggle legend panel"
          aria-label="Toggle legend panel"
          disabled={canvasNodesLength === 0}
          aria-pressed={showLegend}
          className={`flex flex-col items-center gap-1.5 min-w-[44px] min-h-[44px] py-1 rounded text-[11px] leading-tight font-medium transition-colors ${
            canvasNodesLength === 0 ? "opacity-30 cursor-not-allowed"
            : showLegend ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span>Legend</span>
        </button>

        {/* Template Gallery Dialog */}
        <Dialog open={showTemplates} onOpenChange={handleCloseDialog}>
          <DialogContent 
            className="border border-slate-200 dark:border-slate-800 max-w-5xl p-0 overflow-hidden bg-background/95 backdrop-blur-lg shadow-2xl flex flex-col md:flex-row h-[80vh] md:h-[580px] max-h-[90vh]"
            style={{ 
              left: `calc(50% + ${position.x}px)`, 
              top: `calc(50% + ${position.y}px)` 
            }}
          >
            
            {/* Left Side: Sidebar navigation OR Append choices */}
            <div className="w-full md:w-[280px] bg-slate-50/50 dark:bg-slate-950/40 p-5 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/60 shrink-0">
              {selectedTemplateKey === null ? (
                // Category list view
                <div className="space-y-6">
                  <div onPointerDown={onPointerDown} className="cursor-move pt-2 -mt-2">
                    <h3 className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">Pedigree Starter Kit</h3>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      Template Library
                    </h2>
                  </div>

                  <nav className="space-y-1" aria-label="Template categories">
                    {categories.map((cat) => (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                          activeCategory === cat.id
                            ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        {cat.icon}
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </nav>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      Select a pedigree layout to load. If your canvas contains existing elements, you can insert it side-by-side or perform a clean replace.
                    </div>
                  </div>
                </div>
              ) : (
                // Append choice view (only triggers if canvasNodesLength > 0)
                <div className="space-y-6">
                  <div>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateKey(null)}
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-foreground uppercase tracking-wider mb-2"
                    >
                      <ArrowLeft className="w-3 h-3" /> Back
                    </button>
                    <h3 className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">Action Required</h3>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                      Insert Template
                    </h2>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        openConfirm(
                          "Replace Pedigree",
                          "Are you sure you want to delete all current nodes and replace the canvas with this template?",
                          () => handleLoadReplace(selectedTemplateKey)
                        );
                      }}
                      className="w-full flex items-start gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 text-left transition-colors"
                    >
                      <Trash2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold">Replace Pedigree</div>
                        <div className="text-[10px] opacity-80 mt-0.5 leading-normal">
                          Deletes all current work and loads the template starting at coordinate zero.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleLoadAppend(selectedTemplateKey)}
                      className="w-full flex items-start gap-3 p-3 rounded-lg border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 text-teal-600 dark:text-teal-400 text-left transition-colors"
                    >
                      <Plus className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold">Add Side-by-Side</div>
                        <div className="text-[10px] opacity-80 mt-0.5 leading-normal">
                          Keeps current work and appends this template to the right as a separate tree.
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="text-[10px] text-muted-foreground leading-normal bg-accent/20 p-2.5 rounded">
                    Once added side-by-side, you can connect nodes between the two families using the standard linking tools.
                  </div>
                </div>
              )}

              <div className="text-[9px] text-slate-400 dark:text-slate-500 leading-relaxed hidden md:block">
                All templates load instantly and run locally on your device. Overwriting will clear local undo history.
              </div>
            </div>

            {/* Right Side: Options Grid */}
            <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-6">
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    {categories.find(c => c.id === activeCategory)?.label ?? "Starter Templates"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Select a pedigree baseline layout to populate your canvas environment.
                  </DialogDescription>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredTemplates.map((tpl) => (
                    <button
                      type="button"
                      key={tpl.key}
                      onClick={() => {
                        if (canvasNodesLength === 0) {
                          handleLoadReplace(tpl.key);
                        } else {
                          setSelectedTemplateKey(tpl.key);
                        }
                      }}
                      className="group flex flex-col items-center justify-between p-4 rounded-xl border border-border/60 bg-card hover:bg-accent/40 hover:border-border transition-all text-center h-48 focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <div className="flex-1 flex items-center justify-center p-2 rounded bg-accent/30 group-hover:bg-accent/70 transition-colors w-full overflow-hidden">
                        {getTemplateSvg(tpl.key)}
                      </div>
                      <div className="mt-3 w-full">
                        <h5 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {tpl.name}
                        </h5>
                        <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                          {tpl.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={handleCloseDialog}
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-border hover:bg-accent transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

          </DialogContent>
        </Dialog>
      </div>
      {!labelHidden && <div className="text-[10px] text-muted-foreground uppercase tracking-wider text-center border-t border-border/40 pt-1">Clinical</div>}
    </div>
  );
}
