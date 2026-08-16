import { useMemo } from "react";
import { Link2, Clock, Users, ShieldCheck } from "lucide-react";
import type { PedigreeNode, PedigreeEdge } from "@/features/pedigree-editor/canvas/types";

interface PedigreeSummaryPanelProps {
  title: string;
  subtitle: string;
  nodes: PedigreeNode[];
  edges: PedigreeEdge[];
  footerText?: string;
  onDragStart?: (e: React.PointerEvent) => void;
}

export function PedigreeSummaryPanel({
  title,
  subtitle,
  nodes,
  edges,
  footerText,
  onDragStart,
}: PedigreeSummaryPanelProps) {
  const totalPatients = nodes.length;
  const relationshipCount = edges.length;
  const affectedCount = useMemo(() => nodes.filter(n => n.affected).length, [nodes]);
  const carrierCount = useMemo(() => nodes.filter(n => n.carrier && !n.affected).length, [nodes]);

  return (
    <div className="w-full md:w-[280px] bg-slate-50/50 dark:bg-slate-950/40 p-6 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/60 relative shrink-0">
      <div className="space-y-6">
        <div onPointerDown={onDragStart} className={onDragStart ? "cursor-move pt-2 -mt-2" : undefined}>
          <h3 className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest">Active Pedigree</h3>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1 truncate" title={title || "Untitled Pedigree"}>
            {title || "Untitled Pedigree"}
          </h2>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-500 dark:text-slate-400">
            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            <span>{subtitle}</span>
          </div>
        </div>

        {/* Decorative DNA Helix Vector Graphic */}
        <div className="hidden md:flex justify-center py-4 opacity-75">
          <svg className="w-32 h-20 text-teal-600/20 dark:text-teal-400/25" viewBox="0 0 100 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10,20 Q25,5 40,20 T70,20 T100,20" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
            <path d="M10,40 Q25,55 40,40 T70,40 T100,40" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
            <line x1="20" y1="13" x2="20" y2="47" stroke="currentColor" strokeWidth="1.5" />
            <line x1="35" y1="17" x2="35" y2="43" stroke="currentColor" strokeWidth="1.5" />
            <line x1="50" y1="20" x2="50" y2="40" stroke="currentColor" strokeWidth="1.5" />
            <line x1="65" y1="23" x2="65" y2="37" stroke="currentColor" strokeWidth="1.5" />
            <line x1="80" y1="20" x2="80" y2="40" stroke="currentColor" strokeWidth="1.5" />
            <rect x="18" y="10" width="4" height="4" fill="#2dd4bf" rx="0.5" />
            <circle cx="20" cy="50" r="2.5" fill="#f43f5e" />
            <rect x="33" y="14" width="4" height="4" fill="#2dd4bf" rx="0.5" />
            <circle cx="35" cy="45" r="2.5" fill="#f43f5e" />
            <rect x="48" y="18" width="4" height="4" fill="#2dd4bf" rx="0.5" />
            <circle cx="50" cy="42" r="2.5" fill="#f43f5e" />
          </svg>
        </div>

        {/* Pedigree Metrics list */}
        <div className="space-y-4">
          <h4 className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Canvas Content</h4>
          
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Total Individuals</span>
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">{totalPatients}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Relationships</span>
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white">{relationshipCount}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>Affected Patients</span>
            </span>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{affectedCount}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Carrier Members</span>
            </span>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{carrierCount}</span>
          </div>
        </div>
      </div>

      {footerText && (
        <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-6 leading-relaxed hidden md:block">
          {footerText}
        </div>
      )}
    </div>
  );
}
