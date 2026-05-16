import { Share2, Download, ChevronDown, Loader2, ShieldCheck, FileText, Presentation, FileJson } from "lucide-react";

interface ShareGroupProps {
  setShowShareModal: (v: boolean) => void;
  showExportMenu: boolean;
  setShowExportMenu: (v: boolean) => void;
  exportingFormat: string | null;
  handleExportReport: () => void;
  handleExportPDF: () => void;
  handleExportPPTX: () => void;
  handleExportPNG: () => void;
  handleExportSVG: () => void;
  handleExportJSON: () => void;
  handleExportPPRO: () => void;
  labelHidden?: boolean;
}

export function ShareGroup({
  setShowShareModal, showExportMenu, setShowExportMenu, exportingFormat,
  handleExportReport, handleExportPDF, handleExportPPTX,
  handleExportPNG, handleExportSVG, handleExportJSON, handleExportPPRO, labelHidden = false,
}: ShareGroupProps) {
  return (
    <div className="flex flex-col justify-between border-l border-border flex-shrink-0 px-2 pt-2 pb-2">
      <div className="flex items-center gap-0.5">
        <button type="button" data-testid="button-share" onClick={() => setShowShareModal(true)} title="Share this pedigree" aria-label="Share this pedigree"
          className="flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
        <div className="relative">
          <button type="button" data-testid="button-export" onClick={() => setShowExportMenu(!showExportMenu)} title="Export pedigree" aria-label="Export pedigree"
            className={`flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] py-1 rounded text-xs leading-none transition-colors ${showExportMenu ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
            <div className="flex items-center gap-0.5"><Download className="w-4 h-4" /><ChevronDown className="w-2.5 h-2.5" /></div>
            <span>{exportingFormat ? "…" : "Export"}</span>
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-56 border border-border rounded-lg shadow-xl overflow-hidden bg-popover">
                <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">Export As</div>
                {([
                  { id: "report", label: "Clinical Report (PDF)", sub: "Pedigree + risk + validation", icon: <ShieldCheck className="w-4 h-4 text-green-400" />, fn: handleExportReport },
                  { id: "pdf", label: "Pedigree Diagram (PDF)", sub: "Landscape diagram only", icon: <FileText className="w-4 h-4 text-red-400" />, fn: handleExportPDF },
                  { id: "pptx", label: "PowerPoint (.pptx)", sub: "Editable shapes", icon: <Presentation className="w-4 h-4 text-orange-400" />, fn: handleExportPPTX },
                  { id: "svg", label: "SVG Image (.svg)", sub: "Scalable vector graphic", icon: <FileText className="w-4 h-4 text-purple-400" />, fn: handleExportSVG },
                  { id: "png", label: "PNG Image (.png)", sub: "High-resolution bitmap (2x)", icon: <FileJson className="w-4 h-4 text-cyan-400" />, fn: handleExportPNG },
                  { id: "json", label: "JSON", sub: "Raw canvas data", icon: <FileJson className="w-4 h-4 text-blue-400" />, fn: handleExportJSON },
                  { id: "ppro", label: "Pedigree PRO (.ppro)", sub: "Full provenance + history", icon: <FileJson className="w-4 h-4 text-emerald-400" />, fn: handleExportPPRO },
                ] as const).map((item, i) => (
                  <button type="button" key={item.id} data-testid={`button-export-${item.id}`}
                    onClick={item.fn} disabled={!!exportingFormat}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent transition-colors disabled:opacity-40 text-left ${i > 0 ? "border-t border-border" : ""}`}>
                    {exportingFormat === item.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : item.icon}
                    <div>
                      <div className="text-xs font-medium">
                        {exportingFormat === item.id ? "Exporting..." : item.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {!labelHidden && <div className="text-xs text-muted-foreground uppercase tracking-widest text-center border-t border-border/40 pt-0.5">Share</div>}
    </div>
  );
}
